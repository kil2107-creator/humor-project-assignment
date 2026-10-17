"use client";

import {
    useEffect,
    useState,
} from "react";

import type {
    ChangeEvent,
    FormEvent,
} from "react";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Props = {
    initialProfile: {
        first_name: string;
        last_name: string;
        username: string;
        avatar_path: string;
    };
    email: string;
};

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];

const MAX_AVATAR_SIZE =
    2 * 1024 * 1024;

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

export default function ProfileForm({
                                        initialProfile,
                                        email,
                                    }: Props) {
    const supabase = createClient();

    const [firstName, setFirstName] =
        useState(
            initialProfile.first_name
        );

    const [lastName, setLastName] =
        useState(
            initialProfile.last_name
        );

    const [username, setUsername] =
        useState(
            initialProfile.username
        );

    /*
     * Only the Supabase Storage path
     * is stored in the database.
     */
    const [avatarPath, setAvatarPath] =
        useState(
            initialProfile.avatar_path
        );

    /*
     * A newly chosen image stays as a File
     * in the browser until Save Profile.
     */
    const [
        selectedFile,
        setSelectedFile,
    ] = useState<File | null>(null);

    const [
        selectedFileName,
        setSelectedFileName,
    ] = useState("");

    /*
     * Temporary local preview for a newly
     * selected profile image.
     */
    const [
        localPreviewUrl,
        setLocalPreviewUrl,
    ] = useState("");

    const [message, setMessage] =
        useState("");

    const [saving, setSaving] =
        useState(false);

    const needsProfile =
        !firstName.trim() ||
        !lastName.trim() ||
        !username.trim();

    /*
     * Get the public URL for the avatar
     * already stored in Supabase.
     */
    const savedAvatarUrl =
        avatarPath
            ? supabase.storage
                .from("avatars")
                .getPublicUrl(
                    avatarPath
                ).data.publicUrl
            : "";

    /*
     * Prefer a newly selected photo preview.
     * Otherwise show the currently saved photo.
     */
    const displayedAvatar =
        localPreviewUrl ||
        savedAvatarUrl;

    /*
     * Determines whether a status message
     * should use success/neutral or error styling.
     */
    const messageIsError =
        message.startsWith("Error:") ||
        message.includes(
            "already taken"
        ) ||
        message.includes(
            "must be"
        ) ||
        message.includes(
            "Please choose"
        ) ||
        message.includes(
            "Could not"
        ) ||
        message.includes(
            "must be signed in"
        );

    /*
     * Clean up temporary browser image URLs.
     */
    useEffect(() => {
        return () => {
            if (localPreviewUrl) {
                URL.revokeObjectURL(
                    localPreviewUrl
                );
            }
        };
    }, [localPreviewUrl]);

    function choosePhoto(
        event:
        ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (
            !ALLOWED_IMAGE_TYPES.includes(
                file.type
            )
        ) {
            setMessage(
                "Please choose a JPEG, PNG, or WebP image."
            );
            return;
        }

        if (
            file.size >
            MAX_AVATAR_SIZE
        ) {
            setMessage(
                "Please choose a profile photo smaller than 2 MB."
            );
            return;
        }

        setSelectedFile(file);

        setSelectedFileName(
            file.name
        );

        setLocalPreviewUrl(
            URL.createObjectURL(file)
        );

        setMessage("");
    }

    async function saveProfile(
        event:
        FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const cleanUsername =
            username.trim();

        /*
         * Validate username before uploading
         * a new profile photo.
         */
        if (
            !/^[A-Za-z0-9_]{3,20}$/.test(
                cleanUsername
            )
        ) {
            setMessage(
                "Username must be 3–20 characters and contain only letters, numbers, and underscores."
            );
            return;
        }

        setSaving(true);
        setMessage("");

        /*
         * Confirm the user is authenticated.
         */
        const {
            data: { user },
            error: userError,
        } =
            await supabase.auth.getUser();

        if (
            userError ||
            !user
        ) {
            setMessage(
                "You must be signed in to save your profile."
            );

            setSaving(false);
            return;
        }

        /*
         * Keep the existing avatar unless
         * a new one has been selected.
         */
        let newAvatarPath =
            avatarPath || null;

        let uploadedNewAvatar =
            false;

        /*
         * Upload a new avatar if needed.
         */
        if (selectedFile) {
            const extension =
                getFileExtension(
                    selectedFile.type
                );

            newAvatarPath =
                `${user.id}/${crypto.randomUUID()}.${extension}`;

            const {
                error: uploadError,
            } =
                await supabase.storage
                    .from("avatars")
                    .upload(
                        newAvatarPath,
                        selectedFile,
                        {
                            contentType:
                            selectedFile.type,
                            upsert: false,
                        }
                    );

            if (uploadError) {
                console.error(
                    "Avatar upload error:",
                    uploadError
                );

                setMessage(
                    `Could not upload profile photo: ${uploadError.message}`
                );

                setSaving(false);
                return;
            }

            uploadedNewAvatar =
                true;
        }

        /*
         * Update profile information.
         *
         * Only avatar_path is stored in
         * the relational database.
         */
        const { error } =
            await supabase.rpc(
                "update_my_profile",
                {
                    p_first_name:
                    firstName,
                    p_last_name:
                    lastName,
                    p_username:
                    cleanUsername,
                    p_avatar_path:
                    newAvatarPath,
                }
            );

        if (error) {
            /*
             * If the new avatar uploaded but
             * the profile save failed, remove
             * that new file from Storage.
             */
            if (
                uploadedNewAvatar &&
                newAvatarPath
            ) {
                await supabase.storage
                    .from("avatars")
                    .remove([
                        newAvatarPath,
                    ]);
            }

            if (
                error.code ===
                "23505"
            ) {
                setMessage(
                    "That username is already taken. Try another one."
                );
            } else if (
                error.code ===
                "23514"
            ) {
                setMessage(
                    "Username must be 3–20 characters and contain only letters, numbers, and underscores."
                );
            } else {
                setMessage(
                    `Error: ${error.message}`
                );
            }

            setSaving(false);
            return;
        }

        /*
         * After the profile successfully saves,
         * remove the old avatar from Storage.
         */
        if (
            uploadedNewAvatar &&
            avatarPath &&
            avatarPath !==
            newAvatarPath
        ) {
            const {
                error:
                    oldAvatarDeleteError,
            } =
                await supabase.storage
                    .from("avatars")
                    .remove([
                        avatarPath,
                    ]);

            if (
                oldAvatarDeleteError
            ) {
                console.warn(
                    "Could not remove old avatar:",
                    oldAvatarDeleteError
                );
            }
        }

        /*
         * Sync the new saved state locally.
         */
        setAvatarPath(
            newAvatarPath ?? ""
        );

        setSelectedFile(null);
        setSelectedFileName("");
        setLocalPreviewUrl("");

        setMessage(
            "Profile saved!"
        );

        setSaving(false);
    }

    async function signOut() {
        await supabase.auth.signOut();

        window.location.href =
            "/login";
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
                    Profile
                </h1>

                <p className="product-subtitle">
                    Manage your identity and
                    account.
                </p>

                {/* Incomplete profile warning */}

                {needsProfile && (
                    <div
                        className="product-message"
                        style={{
                            marginBottom:
                                "20px",
                            marginTop: 0,
                        }}
                    >
                        Please add your first
                        name, last name, and
                        username to complete
                        your profile.
                    </div>
                )}

                {/* Main profile card */}

                <section className="product-panel">

                    {/* Avatar + account identity */}

                    <div className="profile-top">
                        {displayedAvatar ? (
                            <img
                                src={
                                    displayedAvatar
                                }
                                alt="Profile"
                                className="profile-avatar"
                            />
                        ) : (
                            <div
                                className="profile-avatar"
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center",
                                    background:
                                        "var(--surface-secondary)",
                                    color:
                                        "var(--accent)",
                                    fontSize:
                                        "34px",
                                    fontWeight:
                                        800,
                                }}
                            >
                                {firstName
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase() ||
                                    username
                                        .trim()
                                        .charAt(
                                            0
                                        )
                                        .toUpperCase() ||
                                    "?"}
                            </div>
                        )}

                        <div>
                            <p
                                style={{
                                    margin:
                                        "0 0 5px",
                                    fontSize:
                                        "20px",
                                    fontWeight:
                                        700,
                                }}
                            >
                                {firstName ||
                                lastName
                                    ? `${firstName} ${lastName}`.trim()
                                    : "Your profile"}
                            </p>

                            {username && (
                                <p
                                    style={{
                                        margin:
                                            "0 0 5px",
                                        color:
                                            "var(--accent)",
                                        fontSize:
                                            "14px",
                                        fontWeight:
                                            700,
                                    }}
                                >
                                    @
                                    {
                                        username
                                    }
                                </p>
                            )}

                            <p className="profile-email">
                                {email}
                            </p>
                        </div>
                    </div>

                    {/* Editable profile fields */}

                    <form
                        onSubmit={
                            saveProfile
                        }
                        className="product-form"
                    >
                        <div className="product-field">
                            <label
                                htmlFor="first-name"
                                className="product-label"
                            >
                                First name
                            </label>

                            <input
                                id="first-name"
                                value={
                                    firstName
                                }
                                onChange={(
                                    event
                                ) => {
                                    setFirstName(
                                        event
                                            .target
                                            .value
                                    );

                                    setMessage(
                                        ""
                                    );
                                }}
                                required
                                className="product-input"
                            />
                        </div>

                        <div className="product-field">
                            <label
                                htmlFor="last-name"
                                className="product-label"
                            >
                                Last name
                            </label>

                            <input
                                id="last-name"
                                value={
                                    lastName
                                }
                                onChange={(
                                    event
                                ) => {
                                    setLastName(
                                        event
                                            .target
                                            .value
                                    );

                                    setMessage(
                                        ""
                                    );
                                }}
                                required
                                className="product-input"
                            />
                        </div>

                        <div className="product-field">
                            <label
                                htmlFor="username"
                                className="product-label"
                            >
                                Username
                            </label>

                            <input
                                id="username"
                                value={
                                    username
                                }
                                onChange={(
                                    event
                                ) => {
                                    setUsername(
                                        event
                                            .target
                                            .value
                                    );

                                    setMessage(
                                        ""
                                    );
                                }}
                                placeholder="e.g. morningside_rat"
                                minLength={3}
                                maxLength={20}
                                pattern="[A-Za-z0-9_]{3,20}"
                                title="3–20 characters. Letters, numbers, and underscores only."
                                required
                                className="product-input"
                            />

                            <p className="product-helper">
                                Your username is
                                visible with your
                                captions to signed-in
                                users. Use 3–20
                                letters, numbers, or
                                underscores.
                            </p>
                        </div>

                        {/* Profile photo */}

                        <div className="product-field">
                            <span className="product-label">
                                Profile photo
                            </span>

                            <div className="profile-photo-controls">
                                <label
                                    htmlFor="profile-photo"
                                    className="secondary-button"
                                >
                                    Choose photo
                                </label>

                                <input
                                    id="profile-photo"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={
                                        choosePhoto
                                    }
                                    style={{
                                        display:
                                            "none",
                                    }}
                                />

                                {selectedFileName && (
                                    <span className="product-helper">
                                        {
                                            selectedFileName
                                        }
                                    </span>
                                )}
                            </div>

                            <p className="product-helper">
                                JPEG, PNG, or WebP.
                                Maximum 2 MB.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={
                                saving
                            }
                            className="primary-button"
                        >
                            {saving
                                ? "Saving..."
                                : "Save Profile"}
                        </button>
                    </form>
                </section>

                {/* Save / error message */}

                {message && (
                    <div
                        className={
                            messageIsError
                                ? "product-error"
                                : "product-message"
                        }
                    >
                        {message}
                    </div>
                )}

                {/* Navigation */}

                <div className="product-actions">
                    <Link
                        href="/"
                        className="secondary-button"
                    >
                        ← Back to Feed
                    </Link>

                    <Link
                        href="/create"
                        className="primary-button"
                    >
                        + Create Caption
                    </Link>

                    <button
                        onClick={
                            signOut
                        }
                        type="button"
                        className="secondary-button"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </main>
    );
}

