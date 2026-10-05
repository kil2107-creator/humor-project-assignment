"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
    generationId: string;
    imagePath: string;
};

export default function DeleteCaptionButton({
                                                generationId,
                                                imagePath,
                                            }: Props) {
    const router = useRouter();

    const [deleting, setDeleting] =
        useState(false);

    const [error, setError] =
        useState("");

    async function deleteCaption() {
        const confirmed = window.confirm(
            "Delete this caption? This cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        setDeleting(true);
        setError("");

        const supabase = createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setError("You must be signed in.");
            setDeleting(false);
            return;
        }

        /*
         * Delete the database record.
         * RLS ensures the user can only delete
         * their own caption.
         */
        const {
            data: deletedGeneration,
            error: databaseError,
        } = await supabase
            .from("caption_generations")
            .delete()
            .eq("id", generationId)
            .eq("user_id", user.id)
            .select("id")
            .maybeSingle();

        if (
            databaseError ||
            !deletedGeneration
        ) {
            setError(
                databaseError?.message ??
                "You cannot delete this caption."
            );

            setDeleting(false);
            return;
        }

        /*
         * Remove the associated image
         * from Supabase Storage.
         */
        const { error: storageError } =
            await supabase.storage
                .from("caption-images")
                .remove([imagePath]);

        if (storageError) {
            console.error(
                "Image cleanup failed:",
                storageError
            );
        }

        router.refresh();
    }

    return (
        <div style={{ marginTop: "16px" }}>
            <button
                type="button"
                onClick={deleteCaption}
                disabled={deleting}
                style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d0cdd5",
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    cursor: deleting
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "13px",
                }}
            >
                {deleting
                    ? "Deleting..."
                    : "Delete my caption"}
            </button>

            {error && (
                <p
                    style={{
                        marginTop: "8px",
                        color: "#b00020",
                        fontSize: "13px",
                    }}
                >
                    {error}
                </p>
            )}
        </div>
    );
}
