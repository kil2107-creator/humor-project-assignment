"use client";

import {
    useEffect,
    useState,
} from "react";

import type {
    FormEvent,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Draft = {
    caption: string;
    fullPrompt: string;
    model: string;
    vibe: string;
};

const vibes = [
    "Dry",
    "Chaotic",
    "NYC local",
    "Wholesome",
    "Chronically online",
];

export default function CreateCaptionForm() {
    const router = useRouter();

    const [image, setImage] =
        useState<File | null>(null);

    const [imagePreview, setImagePreview] =
        useState("");

    const [prompt, setPrompt] =
        useState("");

    const [vibe, setVibe] =
        useState("Dry");

    const [draft, setDraft] =
        useState<Draft | null>(null);

    const [
        generating,
        setGenerating,
    ] = useState(false);

    const [
        posting,
        setPosting,
    ] = useState(false);

    const [error, setError] =
        useState("");

    const [
        needsUsername,
        setNeedsUsername,
    ] = useState(false);

    /*
     * Clean up temporary browser image URLs.
     */
    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(
                    imagePreview
                );
            }
        };
    }, [imagePreview]);

    function selectImage(
        file: File | null
    ) {
        if (imagePreview) {
            URL.revokeObjectURL(
                imagePreview
            );
        }

        setImage(file);
        setDraft(null);
        setError("");
        setNeedsUsername(false);

        if (file) {
            setImagePreview(
                URL.createObjectURL(file)
            );
        } else {
            setImagePreview("");
        }
    }

    async function generateCaption(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!image) {
            setError(
                "Please choose an image."
            );
            return;
        }

        if (!prompt.trim()) {
            setError(
                "Tell the AI what kind of caption you want."
            );
            return;
        }

        setGenerating(true);
        setError("");
        setNeedsUsername(false);
        setDraft(null);

        const formData =
            new FormData();

        formData.append(
            "image",
            image
        );

        formData.append(
            "prompt",
            prompt.trim()
        );

        formData.append(
            "vibe",
            vibe
        );

        try {
            /*
             * Browser-side timeout so the page
             * does not stay on "Generating..."
             * forever if Gemini hangs.
             */
            const controller =
                new AbortController();

            const timeoutId =
                setTimeout(() => {
                    controller.abort();
                }, 40000);

            let response: Response;

            try {
                response =
                    await fetch(
                        "/api/generate-caption",
                        {
                            method: "POST",
                            body: formData,
                            signal:
                            controller.signal,
                        }
                    );
            } finally {
                clearTimeout(timeoutId);
            }

            const result =
                await response.json();

            if (!response.ok) {
                setError(
                    result.error ??
                    "Could not generate caption."
                );
                return;
            }

            setDraft(result.draft);
        } catch (error) {
            console.error(error);

            if (
                error instanceof Error &&
                error.name === "AbortError"
            ) {
                setError(
                    "Caption generation is taking longer than expected. Please try again. If this keeps happening, try using a smaller image."
                );
            } else {
                setError(
                    "Could not generate caption."
                );
            }
        } finally {
            setGenerating(false);
        }
    }

    async function postCaption() {
        if (!image || !draft) {
            return;
        }

        setPosting(true);
        setError("");
        setNeedsUsername(false);

        const formData =
            new FormData();

        formData.append(
            "image",
            image
        );

        formData.append(
            "caption",
            draft.caption
        );

        formData.append(
            "full_prompt",
            draft.fullPrompt
        );

        formData.append(
            "model",
            draft.model
        );

        formData.append(
            "vibe",
            draft.vibe
        );

        try {
            const response =
                await fetch(
                    "/api/post-caption",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {
                const errorMessage =
                    result.error ??
                    "Could not post caption.";

                setError(
                    errorMessage
                );

                /*
                 * If the API says the user needs
                 * a username, show a direct link
                 * to Profile.
                 */
                if (
                    errorMessage
                        .toLowerCase()
                        .includes(
                            "choose a username"
                        )
                ) {
                    setNeedsUsername(
                        true
                    );
                }

                return;
            }

            /*
             * Successfully posted.
             * Return to the main feed.
             */
            router.push("/");
            router.refresh();
        } catch (error) {
            console.error(error);

            setError(
                "Could not post caption."
            );
        } finally {
            setPosting(false);
        }
    }

    return (
        <main className="product-page">
            <div className="product-container">

                {/* Shared product branding */}

                <Link
                    href="/"
                    className="product-brand"
                >
                    <span className="product-brand-kicker">
                        Columbia × NYC
                    </span>

                    <span className="product-brand-name">
                        Morningside Caption Club
                    </span>
                </Link>

                <h1 className="product-heading">
                    Create a Caption
                </h1>

                <p className="product-subtitle">
                    Turn a campus or NYC moment
                    into an AI caption. Generate
                    it first, then post it only
                    if you like it.
                </p>

                {/* Caption creation form */}

                <form
                    onSubmit={
                        generateCaption
                    }
                    className="product-panel product-form"
                >
                    <div className="product-field">
                        <label
                            htmlFor="caption-image"
                            className="product-label"
                        >
                            Upload a photo
                        </label>

                        <input
                            id="caption-image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(
                                event
                            ) =>
                                selectImage(
                                    event
                                        .target
                                        .files?.[0] ??
                                    null
                                )
                            }
                            className="product-input"
                        />

                        <p className="product-helper">
                            JPEG, PNG, or WebP.
                            The image will be
                            displayed at its
                            original proportions.
                        </p>
                    </div>

                    <div className="product-field">
                        <label
                            htmlFor="caption-prompt"
                            className="product-label"
                        >
                            What should the
                            caption be about?
                        </label>

                        <textarea
                            id="caption-prompt"
                            value={prompt}
                            onChange={(
                                event
                            ) => {
                                setPrompt(
                                    event
                                        .target
                                        .value
                                );

                                setDraft(
                                    null
                                );

                                setError("");
                                setNeedsUsername(
                                    false
                                );
                            }}
                            rows={4}
                            placeholder="Example: Make fun of how long we waited for the 1 train..."
                            className="product-input"
                        />
                    </div>

                    <div className="product-field">
                        <span className="product-label">
                            Choose a vibe
                        </span>

                        <div className="vibe-options">
                            {vibes.map(
                                (
                                    option
                                ) => (
                                    <button
                                        key={
                                            option
                                        }
                                        type="button"
                                        onClick={() => {
                                            setVibe(
                                                option
                                            );

                                            setDraft(
                                                null
                                            );

                                            setError(
                                                ""
                                            );

                                            setNeedsUsername(
                                                false
                                            );
                                        }}
                                        className={
                                            vibe ===
                                            option
                                                ? "vibe-button vibe-button-active"
                                                : "vibe-button"
                                        }
                                    >
                                        {
                                            option
                                        }
                                    </button>
                                )
                            )}
                        </div>

                        <p className="product-helper">
                            Selected vibe:{" "}
                            <strong>
                                {vibe}
                            </strong>
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={
                            generating ||
                            posting
                        }
                        className="primary-button"
                    >
                        {generating
                            ? "Generating..."
                            : draft
                                ? "Generate Another"
                                : "Generate Caption"}
                    </button>
                </form>

                {/* Error / username recovery */}

                {error && (
                    <div className="product-error">
                        <p
                            style={{
                                margin: 0,
                            }}
                        >
                            {error}
                        </p>

                        {needsUsername && (
                            <Link
                                href="/profile"
                                className="secondary-button"
                                style={{
                                    marginTop:
                                        "12px",
                                }}
                            >
                                Choose a Username →
                            </Link>
                        )}
                    </div>
                )}

                {/* Generated draft preview */}

                {draft && (
                    <section className="caption-preview-card">

                        {imagePreview && (
                            <div className="caption-preview-image-frame">
                                <img
                                    src={
                                        imagePreview
                                    }
                                    alt="Caption preview"
                                    className="caption-preview-image"
                                />
                            </div>
                        )}

                        <div className="caption-preview-content">
                            <p className="preview-label">
                                Preview — not posted yet
                            </p>

                            <p className="preview-caption">
                                “
                                {
                                    draft.caption
                                }
                                ”
                            </p>

                            <p className="product-helper">
                                Vibe:{" "}
                                <strong>
                                    {
                                        draft.vibe
                                    }
                                </strong>
                            </p>

                            <div className="product-actions">
                                <button
                                    type="button"
                                    onClick={
                                        postCaption
                                    }
                                    disabled={
                                        posting
                                    }
                                    className="primary-button"
                                >
                                    {posting
                                        ? "Posting..."
                                        : "Post to Feed"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraft(
                                            null
                                        );
                                        setError(
                                            ""
                                        );
                                    }}
                                    disabled={
                                        posting
                                    }
                                    className="secondary-button"
                                >
                                    Try Another
                                </button>
                            </div>

                            <p className="product-helper">
                                Not feeling it?
                                Change the prompt or
                                vibe and generate
                                another caption.
                            </p>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

