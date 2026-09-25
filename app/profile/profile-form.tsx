"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Props = {
    initialProfile: {
        first_name: string;
        last_name: string;
        avatar_data: string;
    };
    email: string;
};

export default function ProfileForm({
                                        initialProfile,
                                        email,
                                    }: Props) {
    const [firstName, setFirstName] = useState(
        initialProfile.first_name
    );

    const [lastName, setLastName] = useState(
        initialProfile.last_name
    );

    const [avatarData, setAvatarData] = useState(
        initialProfile.avatar_data
    );

    const [selectedFileName, setSelectedFileName] =
        useState("");

    const [message, setMessage] = useState("");

    const needsProfile =
        !firstName.trim() || !lastName.trim();

    function choosePhoto(
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setMessage("Please choose an image file.");
            return;
        }

        if (file.size > 750_000) {
            setMessage(
                "Please choose an image smaller than 750 KB."
            );
            return;
        }

        setSelectedFileName(file.name);

        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result === "string") {
                setAvatarData(reader.result);
            }
        };

        reader.readAsDataURL(file);
    }

    async function saveProfile(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const supabase = createClient();

        const { error } = await supabase.rpc(
            "update_my_profile",
            {
                p_first_name: firstName,
                p_last_name: lastName,
                p_avatar_data: avatarData || null,
            }
        );

        if (error) {
            setMessage(`Error: ${error.message}`);
            return;
        }

        setMessage("Profile saved!");
    }

    async function signOut() {
        const supabase = createClient();

        await supabase.auth.signOut();

        window.location.href = "/login";
    }

    return (
        <main
            style={{
                maxWidth: "650px",
                margin: "50px auto",
                padding: "40px",
                fontFamily: "Arial",
            }}
        >
            <h1>Profile</h1>

            {needsProfile && (
                <p
                    style={{
                        padding: "12px",
                        background: "#f3f3f3",
                        borderRadius: "6px",
                    }}
                >
                    Please add your first and last name to
                    complete your profile.
                </p>
            )}

            <p>{email}</p>

            {avatarData && (
                <img
                    src={avatarData}
                    alt="Profile"
                    width={120}
                    height={120}
                    style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                    }}
                />
            )}

            <form
                onSubmit={saveProfile}
                style={{
                    display: "grid",
                    gap: "20px",
                    marginTop: "24px",
                }}
            >
                <label>
                    First name
                    <input
                        value={firstName}
                        onChange={(e) =>
                            setFirstName(e.target.value)
                        }
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "10px",
                            marginTop: "6px",
                            border: "1px solid #999",
                            borderRadius: "6px",
                            backgroundColor: "white",
                            fontSize: "16px",
                            boxSizing: "border-box",
                        }}
                    />
                </label>

                <label>
                    Last name
                    <input
                        value={lastName}
                        onChange={(e) =>
                            setLastName(e.target.value)
                        }
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "10px",
                            marginTop: "6px",
                            border: "1px solid #999",
                            borderRadius: "6px",
                            backgroundColor: "white",
                            fontSize: "16px",
                            boxSizing: "border-box",
                        }}
                    />
                </label>

                <div>
                    <p style={{ margin: "0 0 8px 0" }}>
                        Profile photo
                    </p>

                    <label
                        htmlFor="profile-photo"
                        style={{
                            display: "inline-block",
                            padding: "10px 18px",
                            backgroundColor: "#f3f3f3",
                            border: "1px solid #999",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "16px",
                        }}
                    >
                        Choose photo
                    </label>

                    <input
                        id="profile-photo"
                        type="file"
                        accept="image/*"
                        onChange={choosePhoto}
                        style={{
                            display: "none",
                        }}
                    />

                    {selectedFileName && (
                        <span
                            style={{
                                marginLeft: "12px",
                                fontSize: "14px",
                                color: "#555",
                            }}
                        >
              {selectedFileName}
            </span>
                    )}
                </div>

                <button
                    type="submit"
                    style={{
                        padding: "11px 20px",
                        border: "none",
                        borderRadius: "6px",
                        backgroundColor: "#111",
                        color: "white",
                        fontSize: "16px",
                        cursor: "pointer",
                        width: "fit-content",
                    }}
                >
                    Save profile
                </button>
            </form>

            {message && (
                <p
                    style={{
                        marginTop: "16px",
                    }}
                >
                    {message}
                </p>
            )}

            <div
                style={{
                    marginTop: "30px",
                }}
            >
                <Link
                    href="/members"
                    style={{
                        display: "inline-block",
                        padding: "11px 20px",
                        borderRadius: "6px",
                        backgroundColor: "#111",
                        color: "white",
                        textDecoration: "none",
                        fontSize: "16px",
                    }}
                >
                    Go to members-only page
                </Link>
            </div>

            <button
                onClick={signOut}
                type="button"
                style={{
                    marginTop: "20px",
                    padding: "11px 20px",
                    border: "1px solid #999",
                    borderRadius: "6px",
                    backgroundColor: "white",
                    color: "#111",
                    fontSize: "16px",
                    cursor: "pointer",
                }}
            >
                Sign out
            </button>
        </main>
    );
}
