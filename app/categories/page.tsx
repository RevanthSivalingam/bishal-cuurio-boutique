"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id,name")
      .order("name");
    if (error) {
      setErr(error.message);
    } else {
      setCats((data ?? []) as Category[]);
      setErr(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .order("name");
      if (cancelled) return;
      if (error) setErr(error.message);
      else {
        setCats((data ?? []) as Category[]);
        setErr(null);
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("categories").insert({ name });
    if (error) setErr(error.message);
    else setNewName("");
    setCreating(false);
    load();
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("categories")
      .update({ name })
      .eq("id", id);
    if (error) setErr(error.message);
    else setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category? Products in it will become uncategorised.")) return;
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) setErr(error.message);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <div className="flex gap-2">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create} disabled={creating || !newName.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && <p className="text-sm text-zinc-500">Loading...</p>}

      <ul className="flex flex-col gap-2">
        {cats.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between border border-zinc-200 rounded-xl px-3 py-2"
          >
            {editingId === c.id ? (
              <div className="flex gap-2 w-full">
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)}
                />
                <Button size="sm" onClick={() => saveEdit(c.id)}>
                  <Check className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>{c.name}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                    }}
                    aria-label="Edit"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(c.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
        {!loading && cats.length === 0 && (
          <li className="text-sm text-zinc-500">No categories yet.</li>
        )}
      </ul>
    </div>
  );
}
