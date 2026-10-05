"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Props = {
    generationId: string;
    isLoggedIn: boolean;
    existingVote: number | null;
    score: number;
};

export default function VoteButtons({
                                        generationId,
                                        isLoggedIn,
                                        existingVote,
                                        score,
                                    }: Props) {
    const router = useRouter();

    const [vote, setVote] = useState<number | null>(
        existingVote
    );

    const [displayScore, setDisplayScore] =
        useState(score);

    const [message, setMessage] = useState("");

    async function submitVote(newVote: number) {
        if (!isLoggedIn) {
            return;
        }

        const supabase = createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setMessage("Please sign in to vote.");
            return;
        }

        setMessage("");

        /*
         * CASE 1:
         * User clicks the SAME vote again.
         *
         * Example:
         * already upvoted → clicks upvote
         *
         * Remove the vote.
         */
        if (vote === newVote) {
            const { error } = await supabase
                .from("votes")
                .delete()
                .eq("generation_id", generationId)
                .eq("user_id", user.id);

            if (error) {
                setMessage(
                    `Could not remove vote: ${error.message}`
                );
                return;
            }

            setDisplayScore(
                (currentScore) =>
                    currentScore - newVote
            );

            setVote(null);
            setMessage("Vote removed.");

            router.refresh();
            return;
        }

        /*
         * CASE 2:
         * User has not voted yet.
         *
         * Insert a new vote row.
         */
        if (vote === null) {
            const { error } = await supabase
                .from("votes")
                .insert({
                    generation_id: generationId,
                    user_id: user.id,
                    value: newVote,
                });

            if (error) {
                setMessage(
                    `Could not save vote: ${error.message}`
                );
                return;
            }

            setDisplayScore(
                (currentScore) =>
                    currentScore + newVote
            );

            setVote(newVote);
            setMessage("Vote saved!");

            router.refresh();
            return;
        }

        /*
         * CASE 3:
         * User switches their vote.
         *
         * Upvote → downvote
         * Downvote → upvote
         */
        const oldVote = vote;

        const { error } = await supabase
            .from("votes")
            .update({
                value: newVote,
            })
            .eq("generation_id", generationId)
            .eq("user_id", user.id);

        if (error) {
            setMessage(
                `Could not change vote: ${error.message}`
            );
            return;
        }

        setDisplayScore(
            (currentScore) =>
                currentScore + newVote - oldVote
        );

        setVote(newVote);
        setMessage("Vote changed!");

        router.refresh();
    }

    if (!isLoggedIn) {
        return (
            <Link
                href="/login"
                className="sign-in-vote"
            >
                Sign in to vote
            </Link>
        );
    }

    return (
        <div className="vote-area">
            <div className="vote-row">
                <button
                    type="button"
                    onClick={() => submitVote(1)}
                    className={
                        vote === 1
                            ? "vote-button vote-button-active"
                            : "vote-button"
                    }
                    aria-label="Upvote"
                >
                    ↑
                </button>

                <span className="score">
          {displayScore}
        </span>

                <button
                    type="button"
                    onClick={() => submitVote(-1)}
                    className={
                        vote === -1
                            ? "vote-button vote-button-active"
                            : "vote-button"
                    }
                    aria-label="Downvote"
                >
                    ↓
                </button>
            </div>

            {message && (
                <p className="vote-message">
                    {message}
                </p>
            )}
        </div>
    );
}
