"use client";

import {
    useEffect,
    useState,
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

        if (file) {
            setImagePreview(
                URL.createObjectURL(file)
            );
        } else {
            setImagePreview("");
        }
    }

    async function generateCaption(
        event:
        React.FormEvent<HTMLFormElement>
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
            const response =
                await fetch(
                    "/api/generate-caption",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

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

            setError(
                "Could not generate caption."
            );
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
                setError(
                    result.error ??
                    "Could not post caption."
                );
                return;
            }

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
        <main
            style={{
                minHeight: "100vh",
                padding: "50px 20px",
                background:
                    "var(--background)",
                color: "var(--text)",
            }}
        >
            <div
                style={{
                    maxWidth: "680px",
                    margin: "0 auto",
                }}
            >
                <Link href="/">
                    ← Back to feed
                </Link>

                <h1>
                    Create a Caption
                </h1>

                <p
                    style={{
                        color:
                            "var(--text-secondary)",
                    }}
                >
                    Generate it first. Post it
                    only if you like it.
                </p>

                <form
                    onSubmit={
                        generateCaption
                    }
                    style={{
                        marginTop: "28px",
                        display: "grid",
                        gap: "24px",
                        padding: "28px",
                        border:
                            "1px solid var(--border)",
                        borderRadius: "16px",
                        background:
                            "var(--surface)",
                    }}
                >
                    <label>
                        <strong>
                            Upload a photo
                        </strong>

                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) =>
                                selectImage(
                                    event.target.files?.[0] ??
                                    null
                                )
                            }
                            style={{
                                display: "block",
                                marginTop: "10px",
                            }}
                        />
                    </label>

                    <label>
                        <strong>
                            What should the caption
                            be about?
                        </strong>

                        <textarea
                            value={prompt}
                            onChange={(event) => {
                                setPrompt(
                                    event.target.value
                                );

                                setDraft(null);
                            }}
                            rows={4}
                            placeholder="Example: Make fun of how long we waited for the 1 train..."
                            style={{
                                display: "block",
                                width: "100%",
                                marginTop: "10px",
                                padding: "12px",
                                border:
                                    "1px solid var(--border)",
                                borderRadius: "8px",
                                background:
                                    "var(--surface)",
                                color:
                                    "var(--text)",
                                fontSize: "16px",
                                resize: "vertical",
                            }}
                        />
                    </label>

                    <div>
                        <strong>
                            Choose a vibe
                        </strong>

                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                                marginTop: "12px",
                            }}
                        >
                            {vibes.map(
                                (option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                            setVibe(
                                                option
                                            );

                                            setDraft(
                                                null
                                            );
                                        }}
                                        style={{
                                            padding:
                                                "9px 14px",
                                            borderRadius:
                                                "999px",
                                            border:
                                                vibe ===
                                                option
                                                    ? "2px solid var(--text)"
                                                    : "1px solid var(--border)",
                                            background:
                                                vibe ===
                                                option
                                                    ? "var(--text)"
                                                    : "var(--surface)",
                                            color:
                                                vibe ===
                                                option
                                                    ? "var(--background)"
                                                    : "var(--text)",
                                            cursor:
                                                "pointer",
                                        }}
                                    >
                                        {option}
                                    </button>
                                )
                            )}
                        </div>
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

                {error && (
                    <p
                        style={{
                            marginTop: "20px",
                            color: "#b00020",
                        }}
                    >
                        {error}
                    </p>
                )}

                {draft && (
                    <section
                        style={{
                            marginTop: "32px",
                            overflow: "hidden",
                            border:
                                "1px solid var(--border)",
                            borderRadius: "18px",
                            background:
                                "var(--surface)",
                            boxShadow:
                                "var(--shadow)",
                        }}
                    >
                        {imagePreview && (
                            <img
                                src={imagePreview}
                                alt="Caption preview"
                                style={{
                                    display: "block",
                                    width: "100%",
                                    maxHeight:
                                        "500px",
                                    objectFit:
                                        "cover",
                                }}
                            />
                        )}

                        <div
                            style={{
                                padding: "24px",
                            }}
                        >
                            <p
                                style={{
                                    marginTop: 0,
                                    color:
                                        "var(--text-secondary)",
                                    fontSize:
                                        "13px",
                                    fontWeight:
                                        700,
                                    textTransform:
                                        "uppercase",
                                    letterSpacing:
                                        "1px",
                                }}
                            >
                                Preview — not posted yet
                            </p>

                            <p
                                style={{
                                    fontSize: "24px",
                                    fontWeight: 700,
                                    lineHeight: 1.35,
                                }}
                            >
                                “{draft.caption}”
                            </p>

                            <p
                                style={{
                                    color:
                                        "var(--text-secondary)",
                                }}
                            >
                                Vibe:{" "}
                                {draft.vibe}
                            </p>

                            <button
                                type="button"
                                onClick={
                                    postCaption
                                }
                                disabled={posting}
                                className="primary-button"
                            >
                                {posting
                                    ? "Posting..."
                                    : "Post to Feed"}
                            </button>

                            <p
                                style={{
                                    marginBottom: 0,
                                    marginTop:
                                        "12px",
                                    color:
                                        "var(--text-secondary)",
                                    fontSize:
                                        "13px",
                                }}
                            >
                                Not feeling it? Change
                                the prompt or vibe and
                                generate another one.
                            </p>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}