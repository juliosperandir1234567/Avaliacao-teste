import { listEquipamentosTipos } from "../actions";
import { ImportarWordForm } from "./importar-word-form";

export default async function ImportarWordPage() {
  const equipamentos = await listEquipamentosTipos();
  return <ImportarWordForm equipamentos={equipamentos} />;
}
