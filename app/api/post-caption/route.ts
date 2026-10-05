import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

const MAX_IMAGE_SIZE =
    20 * 1024 * 1024;

function getFileExtension(
    mimeType: string
) {
    switch (mimeType) {
        case "image/jpeg":
            return "jpg";

        case "image/png":
            return "png";

        case "image/webp":
            return "webp";

        default:
            return "jpg";
    }
}

export async function POST(
    request: Request
) {
    try {
        const supabase =
            await createClient();

        /*
         * 1. Verify that the user is signed in.
         */
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                {
                    error:
                        "You must be signed in to post a caption.",
                },
                { status: 401 }
            );
        }

        /*
         * 2. Make sure the user has chosen
         * a username before they can post.
         */
        const {
            data: profile,
            error: profileError,
        } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error(
                "Profile lookup error:",
                profileError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not verify your profile. Please try again.",
                },
                { status: 500 }
            );
        }

        if (
            !profile?.username ||
            !profile.username.trim()
        ) {
            return NextResponse.json(
                {
                    error:
                        "Please choose a username in your profile before posting.",
                },
                { status: 400 }
            );
        }

        /*
         * 3. Read the draft information
         * sent by the browser.
         */
        const formData =
            await request.formData();

        const image =
            formData.get("image");

        const caption =
            formData.get("caption");

        const fullPrompt =
            formData.get("full_prompt");

        const model =
            formData.get("model");

        const vibe =
            formData.get("vibe");

        /*
         * 4. Validate the image.
         */
        if (!(image instanceof File)) {
            return NextResponse.json(
                {
                    error:
                        "Image is missing.",
                },
                { status: 400 }
            );
        }

        if (
            !ALLOWED_IMAGE_TYPES.includes(
                image.type
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Please upload a JPEG, PNG, or WebP image.",
                },
                { status: 400 }
            );
        }

        if (
            image.size > MAX_IMAGE_SIZE
        ) {
            return NextResponse.json(
                {
                    error:
                        "Please upload an image smaller than 5 MB.",
                },
                { status: 400 }
            );
        }

        /*
         * 5. Validate the generated caption
         * and its metadata.
         */
        if (
            typeof caption !== "string" ||
            !caption.trim()
        ) {
            return NextResponse.json(
                {
                    error:
                        "Caption is missing.",
                },
                { status: 400 }
            );
        }

        if (
            typeof fullPrompt !== "string" ||
            !fullPrompt.trim()
        ) {
            return NextResponse.json(
                {
                    error:
                        "Prompt is missing.",
                },
                { status: 400 }
            );
        }

        if (
            typeof model !== "string" ||
            !model.trim()
        ) {
            return NextResponse.json(
                {
                    error:
                        "Model information is missing.",
                },
                { status: 400 }
            );
        }

        /*
         * 6. Convert the image into a Buffer
         * for Supabase Storage.
         */
        const imageBuffer =
            Buffer.from(
                await image.arrayBuffer()
            );

        const extension =
            getFileExtension(image.type);

        const imagePath =
            `${user.id}/${crypto.randomUUID()}.${extension}`;

        /*
         * 7. Upload the actual image file
         * to Supabase Storage.
         */
        const { error: uploadError } =
            await supabase.storage
                .from("caption-images")
                .upload(
                    imagePath,
                    imageBuffer,
                    {
                        contentType: image.type,
                        upsert: false,
                    }
                );

        if (uploadError) {
            console.error(
                "Image upload error:",
                uploadError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not upload image.",
                },
                { status: 500 }
            );
        }

        /*
         * 8. Save the caption information
         * in caption_generations.
         *
         * The actual image is NOT stored
         * in the relational database.
         * Only its Storage path is saved.
         */
        const {
            data: generation,
            error: databaseError,
        } = await supabase
            .from("caption_generations")
            .insert({
                user_id: user.id,
                image_path: imagePath,
                prompt: fullPrompt.trim(),
                caption: caption.trim(),
                model: model.trim(),
                vibe:
                    typeof vibe === "string" &&
                    vibe.trim()
                        ? vibe.trim()
                        : null,
            })
            .select()
            .single();

        if (databaseError) {
            /*
             * Remove the uploaded image
             * if saving the database row fails.
             *
             * This prevents orphaned files
             * from staying in Storage.
             */
            await supabase.storage
                .from("caption-images")
                .remove([imagePath]);

            console.error(
                "Database insert error:",
                databaseError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not save caption.",
                },
                { status: 500 }
            );
        }

        /*
         * 9. Get the public URL so the browser
         * can display the posted image.
         */
        const {
            data: { publicUrl },
        } = supabase.storage
            .from("caption-images")
            .getPublicUrl(imagePath);

        /*
         * 10. Return the completed post.
         */
        return NextResponse.json({
            generation: {
                ...generation,
                image_url: publicUrl,
            },
        });
    } catch (error) {
        console.error(
            "Post-caption error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Something went wrong while posting your caption.",
            },
            { status: 500 }
        );
    }
}
