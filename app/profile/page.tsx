import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
    const supabase = await createClient();

    const {
        data: { claims },
    } = await supabase.auth.getClaims();

    if (!claims) {
        redirect("/login");
    }

    const { data: profile, error } = await supabase
        .rpc("get_my_profile")
        .maybeSingle();

    if (error) {
        return (
            <main style={{ padding: "40px" }}>
                <p>Error loading profile: {error.message}</p>
            </main>
        );
    }

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
