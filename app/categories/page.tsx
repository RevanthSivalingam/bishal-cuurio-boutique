"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Tags } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

async function fetchCategories(): Promise<Category[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("categories").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const {
    data: cats = [],
    isLoading,
    error,
  } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("categories").insert({ name });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewName("");
      setMutationError(null);
      invalidate();
    },
    onError: (e) => setMutationError(e instanceof Error ? e.message : "Save failed"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("categories").update({ name }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditingId(null);
      setMutationError(null);
      invalidate();
    },
    onError: (e) => setMutationError(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setMutationError(null);
      invalidate();
    },
    onError: (e) => setMutationError(e instanceof Error ? e.message : "Delete failed"),
  });

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  const saveEdit = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    updateMutation.mutate({ id, name });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this category? Products in it will become uncategorised.")) return;
    deleteMutation.mutate(id);
  };

  const err = mutationError ?? (error instanceof Error ? error.message : null);

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
        <Button onClick={create} disabled={createMutation.isPending || !newName.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      <ul className="flex flex-col gap-2">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center justify-between border border-border rounded-xl px-3 py-2">
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
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
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
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)} aria-label="Delete">
                    <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {!isLoading && cats.length === 0 && (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Add your first category above to start grouping products in the catalog."
        />
      )}
    </div>
  );
}
