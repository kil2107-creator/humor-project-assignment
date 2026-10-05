import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function getErrorStatus(
    error: unknown
): number | undefined {
    if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status ===
        "number"
    ) {
        return (error as { status: number }).status;
    }

    return undefined;
}

export async function POST(request: Request) {
    try {
        /*
         * 1. Verify that the user is logged in.
         */
        const supabase = await createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                {
                    error:
                        "You must be signed in to generate a caption.",
                },
                { status: 401 }
            );
        }

        /*
         * 2. Read the image, prompt, and vibe.
         */
        const formData = await request.formData();

        const image = formData.get("image");
        const userPrompt = formData.get("prompt");
        const vibe = formData.get("vibe");

        if (!(image instanceof File)) {
            return NextResponse.json(
                {
                    error: "Please upload an image.",
                },
                { status: 400 }
            );
        }

        const imageFile: File = image;

        if (
            typeof userPrompt !== "string" ||
            !userPrompt.trim()
        ) {
            return NextResponse.json(
                {
                    error: "Please enter a prompt.",
                },
                { status: 400 }
            );
        }

        const selectedVibe =
            typeof vibe === "string" && vibe.trim()
                ? vibe.trim()
                : "Dry";

        /*
         * 3. Validate the image.
         */
        if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
            return NextResponse.json(
                {
                    error:
                        "Please upload a JPEG, PNG, or WebP image.",
                },
                { status: 400 }
            );
        }

        if (imageFile.size > MAX_IMAGE_SIZE) {
            return NextResponse.json(
                {
                    error:
                        "Please upload an image smaller than 5 MB.",
                },
                { status: 400 }
            );
        }

        /*
         * 4. Convert the image to Base64 for Gemini.
         *
         * This Base64 data is temporary and is NOT
         * saved in the relational database.
         */
        const imageArrayBuffer =
            await imageFile.arrayBuffer();

        const imageBuffer =
            Buffer.from(imageArrayBuffer);

        const base64Image =
            imageBuffer.toString("base64");

        /*
         * 5. Build the full prompt sent to Gemini.
         */
        const fullPrompt = `
You are writing a short, funny social-media caption for a Columbia University / New York City audience.

The user-selected vibe is: ${selectedVibe}.

Additional direction from the user:
${userPrompt.trim()}

Look carefully at the uploaded image and write ONE caption.

Requirements:
- Keep it concise.
- Make it feel natural, clever, and shareable.
- Match the requested vibe.
- Do not explain your reasoning.
- Do not add quotation marks around the caption.
- Return only the final caption.
`.trim();

        /*
         * 6. Make sure the Gemini API key exists.
         */
        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error(
                "GEMINI_API_KEY is missing."
            );

            return NextResponse.json(
                {
                    error:
                        "The AI service is not configured correctly.",
                },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({
            apiKey,
        });

        /*
         * Primary model + fallback model.
         */
        const primaryModel =
            "gemini-3.8-flash";

        const fallbackModel =
            "gemini-3.5-flash-lite";

        async function generateWithModel(
            modelName: string
        ) {
            return await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        inlineData: {
                            mimeType: imageFile.type,
                            data: base64Image,
                        },
                    },
                    {
                        text: fullPrompt,
                    },
                ],
            });
        }

        /*
         * Helper for trying the fallback model.
         */
        async function tryFallbackModel() {
            console.warn(
                `Trying fallback model: ${fallbackModel}`
            );

            try {
                const fallbackResponse =
                    await generateWithModel(
                        fallbackModel
                    );

                return {
                    response: fallbackResponse,
                    model: fallbackModel,
                };
            } catch (fallbackError) {
                const fallbackStatus =
                    getErrorStatus(fallbackError);

                if (fallbackStatus === 429) {
                    return {
                        errorResponse:
                            NextResponse.json(
                                {
                                    error:
                                        "The AI generation limit has been reached for today. Please try again later.",
                                },
                                { status: 429 }
                            ),
                    };
                }

                if (fallbackStatus === 503) {
                    return {
                        errorResponse:
                            NextResponse.json(
                                {
                                    error:
                                        "The AI service is temporarily busy. Please try again in a few minutes.",
                                },
                                { status: 503 }
                            ),
                    };
                }

                throw fallbackError;
            }
        }

        /*
         * 7. Generate the caption.
         *
         * 503:
         * Primary model is busy.
         * Wait briefly, retry once, then use fallback.
         *
         * 429:
         * Primary model quota is exhausted.
         * Try the fallback model immediately.
         */
        let response;
        let model = primaryModel;

        try {
            response =
                await generateWithModel(
                    primaryModel
                );
        } catch (error) {
            const status =
                getErrorStatus(error);

            /*
             * Primary model is temporarily overloaded.
             */
            if (status === 503) {
                console.warn(
                    `${primaryModel} unavailable. Retrying once...`
                );

                await new Promise((resolve) =>
                    setTimeout(resolve, 1500)
                );

                try {
                    response =
                        await generateWithModel(
                            primaryModel
                        );
                } catch (retryError) {
                    const retryStatus =
                        getErrorStatus(retryError);

                    /*
                     * If the retry is also busy OR
                     * has now hit its quota,
                     * try the fallback model.
                     */
                    if (
                        retryStatus === 503 ||
                        retryStatus === 429
                    ) {
                        console.warn(
                            `${primaryModel} still unavailable. Trying fallback model.`
                        );

                        const fallbackResult =
                            await tryFallbackModel();

                        if (
                            "errorResponse" in
                            fallbackResult
                        ) {
                            return fallbackResult.errorResponse;
                        }

                        response =
                            fallbackResult.response;

                        model =
                            fallbackResult.model;
                    } else {
                        throw retryError;
                    }
                }
            }

            /*
             * Primary model has reached its quota.
             */
            else if (status === 429) {
                console.warn(
                    `${primaryModel} quota reached. Trying ${fallbackModel}.`
                );

                const fallbackResult =
                    await tryFallbackModel();

                if (
                    "errorResponse" in
                    fallbackResult
                ) {
                    return fallbackResult.errorResponse;
                }

                response =
                    fallbackResult.response;

                model =
                    fallbackResult.model;
            }

            /*
             * Some unrelated error occurred.
             */
            else {
                throw error;
            }
        }

        /*
         * 8. Get the final caption text.
         */
        const caption =
            response.text?.trim();

        if (!caption) {
            return NextResponse.json(
                {
                    error:
                        "Gemini did not return a caption. Please try again.",
                },
                { status: 502 }
            );
        }

        /*
         * 9. Return a DRAFT only.
         *
         * Nothing is uploaded to Storage yet.
         * Nothing is inserted into caption_generations yet.
         *
         * Posting happens only after the user clicks
         * "Post to Feed."
         */
        return NextResponse.json({
            draft: {
                caption,
                fullPrompt,
                model,
                vibe: selectedVibe,
            },
        });
    } catch (error) {
        console.error(
            "Unexpected generate-caption error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Something went wrong while generating the caption.",
            },
            { status: 500 }
        );
    }
}