"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEquipamentoTipo } from "../actions";

export function EquipamentoRow({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{nome}</span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteEquipamentoTipo(id);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Equipamento excluído");
            router.refresh();
          })
        }
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
