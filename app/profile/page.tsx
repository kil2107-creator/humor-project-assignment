import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

type Profile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_data: string | null;
};

export default async function ProfilePage() {
    const supabase = await createClient();

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims) {
        redirect("/login");
    }

    const claims = claimsData.claims;

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
                    Error loading profile: {profileError.message}
                </p>
            </main>
        );
    }

    const profile = profileData as Profile | null;

    return (
        <ProfileForm
            initialProfile={{
                first_name: profile?.first_name ?? "",
                last_name: profile?.last_name ?? "",
                avatar_data: profile?.avatar_data ?? "",
            }}
            email={
                typeof claims.email === "string"
                    ? claims.email
                    : ""
            }
        />
    );
}
