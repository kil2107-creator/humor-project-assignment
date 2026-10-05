import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateCaptionForm from "./create-caption-form";

export default async function CreatePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return <CreateCaptionForm />;
}
