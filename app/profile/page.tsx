import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

type Profile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_path: string | null;
};

export default async function ProfilePage() {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        redirect("/login");
    }

    const {
        data: profileData,
        error: profileError,
    } = await supabase
        .rpc("get_my_profile")
        .maybeSingle();

    if (profileError) {
        return (
            <main
                style={{
                    padding: "40px",
                    fontFamily: "Arial",
                }}
            >
                <p>
                    Error loading profile:{" "}
                    {profileError.message}
                </p>
            </main>
        );
    }

    const profile =
        profileData as Profile | null;

    return (
        <ProfileForm
            initialProfile={{
                first_name:
                    profile?.first_name ?? "",
                last_name:
                    profile?.last_name ?? "",
                username:
                    profile?.username ?? "",
                avatar_path:
                    profile?.avatar_path ?? "",
            }}
            email={user.email ?? ""}
        />
    );
}