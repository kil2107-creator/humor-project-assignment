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
     * This is now only a Storage path,
     * NOT Base64 image data.
     */
    const [avatarPath, setAvatarPath] =
        useState(
            initialProfile.avatar_path
        );

    /*
     * The actual selected File is kept
     * temporarily in the browser until
     * the user clicks Save profile.
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
     * Temporary browser-only preview
     * for a newly selected photo.
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
     * Get the public URL of the currently
     * saved avatar.
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
     * If the user just selected a new photo,
     * show that preview.
     *
     * Otherwise show the saved Storage image.
     */
    const displayedAvatar =
        localPreviewUrl ||
        savedAvatarUrl;

    /*
     * Clean up browser-created image preview
     * URLs when they are replaced/unmounted.
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

        /*
         * This URL exists only locally
         * in the browser for previewing.
         *
         * It is NOT saved in Supabase.
         */
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
         * Validate username before
         * uploading anything.
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
         * Verify the signed-in user.
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
         * Start by preserving the current
         * avatar path.
         *
         * If a new image was chosen,
         * this gets replaced below.
         */
        let newAvatarPath =
            avatarPath || null;

        let uploadedNewAvatar =
            false;

        /*
         * Upload a new avatar only if the
         * user selected a new file.
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
         * Save the user's text fields and
         * avatar Storage PATH in profiles.
         *
         * No image data is stored in the
         * relational database.
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
             * If we uploaded a new image but
             * the database update failed,
             * clean up the new Storage file.
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
         * The profile update succeeded.
         *
         * If the user uploaded a new avatar,
         * we can now safely delete their old
         * avatar file from Storage.
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
                /*
                 * This is not serious enough
                 * to fail the profile save.
                 */
                console.warn(
                    "Could not remove old avatar:",
                    oldAvatarDeleteError
                );
            }
        }

        /*
         * Update local state to the newly
         * saved Storage path.
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
        <main
            style={{
                maxWidth: "650px",
                margin:
                    "50px auto",
                padding: "40px",
                fontFamily:
                    "Arial",
                color: "#111",
                backgroundColor:
                    "white",
            }}
        >
            <h1>Profile</h1>

            {needsProfile && (
                <p
                    style={{
                        padding:
                            "12px",
                        background:
                            "#f3f3f3",
                        borderRadius:
                            "6px",
                    }}
                >
                    Please add your
                    first name, last
                    name, and username
                    to complete your
                    profile.
                </p>
            )}

            <p>{email}</p>

            {displayedAvatar && (
                <img
                    src={
                        displayedAvatar
                    }
                    alt="Profile"
                    width={120}
                    height={120}
                    style={{
                        borderRadius:
                            "50%",
                        objectFit:
                            "cover",
                        border:
                            "1px solid #ddd",
                    }}
                />
            )}

            <form
                onSubmit={
                    saveProfile
                }
                style={{
                    display:
                        "grid",
                    gap: "20px",
                    marginTop:
                        "24px",
                }}
            >
                <label>
                    First name

                    <input
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
                        }}
                        required
                        style={{
                            display:
                                "block",
                            width:
                                "100%",
                            padding:
                                "10px",
                            marginTop:
                                "6px",
                            border:
                                "1px solid #999",
                            borderRadius:
                                "6px",
                            backgroundColor:
                                "white",
                            color:
                                "#111",
                            fontSize:
                                "16px",
                            boxSizing:
                                "border-box",
                        }}
                    />
                </label>

                <label>
                    Last name

                    <input
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
                        }}
                        required
                        style={{
                            display:
                                "block",
                            width:
                                "100%",
                            padding:
                                "10px",
                            marginTop:
                                "6px",
                            border:
                                "1px solid #999",
                            borderRadius:
                                "6px",
                            backgroundColor:
                                "white",
                            color:
                                "#111",
                            fontSize:
                                "16px",
                            boxSizing:
                                "border-box",
                        }}
                    />
                </label>

                <label>
                    Username

                    <input
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
                        }}
                        placeholder="e.g. morningside_rat"
                        minLength={3}
                        maxLength={20}
                        pattern="[A-Za-z0-9_]{3,20}"
                        title="3–20 characters. Letters, numbers, and underscores only."
                        required
                        style={{
                            display:
                                "block",
                            width:
                                "100%",
                            padding:
                                "10px",
                            marginTop:
                                "6px",
                            border:
                                "1px solid #999",
                            borderRadius:
                                "6px",
                            backgroundColor:
                                "white",
                            color:
                                "#111",
                            fontSize:
                                "16px",
                            boxSizing:
                                "border-box",
                        }}
                    />

                    <span
                        style={{
                            display:
                                "block",
                            marginTop:
                                "5px",
                            color:
                                "#666",
                            fontSize:
                                "13px",
                        }}
                    >
                        3–20 characters.
                        Letters, numbers,
                        and underscores
                        only.
                    </span>
                </label>

                <div>
                    <p
                        style={{
                            margin:
                                "0 0 8px 0",
                        }}
                    >
                        Profile photo
                    </p>

                    <label
                        htmlFor="profile-photo"
                        style={{
                            display:
                                "inline-block",
                            padding:
                                "10px 18px",
                            backgroundColor:
                                "#f3f3f3",
                            color:
                                "#111",
                            border:
                                "1px solid #999",
                            borderRadius:
                                "6px",
                            cursor:
                                "pointer",
                            fontSize:
                                "16px",
                        }}
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
                        <span
                            style={{
                                marginLeft:
                                    "12px",
                                fontSize:
                                    "14px",
                                color:
                                    "#444",
                            }}
                        >
                            {
                                selectedFileName
                            }
                        </span>
                    )}

                    <p
                        style={{
                            margin:
                                "8px 0 0",
                            color:
                                "#666",
                            fontSize:
                                "13px",
                        }}
                    >
                        JPEG, PNG, or
                        WebP. Maximum
                        2 MB.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={
                        saving
                    }
                    style={{
                        padding:
                            "11px 20px",
                        border:
                            "none",
                        borderRadius:
                            "6px",
                        backgroundColor:
                            "#111",
                        color:
                            "white",
                        fontSize:
                            "16px",
                        cursor:
                            saving
                                ? "not-allowed"
                                : "pointer",
                        width:
                            "fit-content",
                        opacity:
                            saving
                                ? 0.6
                                : 1,
                    }}
                >
                    {saving
                        ? "Saving..."
                        : "Save profile"}
                </button>
            </form>

            {message && (
                <p
                    style={{
                        marginTop:
                            "16px",
                    }}
                >
                    {message}
                </p>
            )}

            <div
                style={{
                    marginTop:
                        "30px",
                    display:
                        "flex",
                    gap: "12px",
                    flexWrap:
                        "wrap",
                }}
            >
                <Link
                    href="/"
                    style={{
                        display:
                            "inline-block",
                        padding:
                            "11px 20px",
                        borderRadius:
                            "6px",
                        border:
                            "1px solid #999",
                        backgroundColor:
                            "white",
                        color:
                            "#111",
                        textDecoration:
                            "none",
                        fontSize:
                            "16px",
                    }}
                >
                    ← Back to Feed
                </Link>

                <Link
                    href="/create"
                    style={{
                        display:
                            "inline-block",
                        padding:
                            "11px 20px",
                        borderRadius:
                            "6px",
                        backgroundColor:
                            "#111",
                        color:
                            "white",
                        textDecoration:
                            "none",
                        fontSize:
                            "16px",
                    }}
                >
                    + Create Caption
                </Link>
            </div>

            <button
                onClick={signOut}
                type="button"
                style={{
                    marginTop:
                        "20px",
                    padding:
                        "11px 20px",
                    border:
                        "1px solid #999",
                    borderRadius:
                        "6px",
                    backgroundColor:
                        "white",
                    color:
                        "#111",
                    fontSize:
                        "16px",
                    cursor:
                        "pointer",
                }}
            >
                Sign out
            </button>
        </main>
    );
}

