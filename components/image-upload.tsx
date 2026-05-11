"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
};

const BUCKET = "product-images";

export function ImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="relative aspect-square w-full max-w-[200px] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-2">
          <Image src={value} alt="Product" fill className="object-contain" sizes="200px" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 bg-white/90 dark:bg-zinc-900/90 rounded-full p-2 shadow"
            aria-label="Remove image"
          >
            <Trash2 className="size-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handlePick}
          disabled={uploading}
          className="w-full max-w-[200px] aspect-square flex-col"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <>
              <Camera className="size-6" />
              <span className="text-sm">Add photo</span>
            </>
          )}
        </Button>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
