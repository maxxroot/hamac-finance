import { ALLOWED_ASSETS, ASSET_KIND_LABELS, holdsEuroFunds, type Account, type Asset } from "@hamac/core";
import { Field, FormGrid, MoneyInput, NumberInput, Select } from "@/shared/components/form";

export interface ArbitrageDraft {
  assetId: string | null;
  quantity: number | null;
  counterAssetId: string | null;
  counterQuantity: number | null;
  amount: number | null;
  fee: number | null;
  feeManual: boolean;
}

/** Arbitrage : tout support du compte, sauf une obligation (elle s'achète et se vend) ; les fonds euros d'abord. */
export function arbitrageChoices(account: Account | undefined, assets: readonly Asset[]): Asset[] {
  if (!account) return [];
  return assets
    .filter((a) => a.kind !== "obligation" && ALLOWED_ASSETS[account.kind].includes(a.kind) && (a.kind !== "fonds_euros" || holdsEuroFunds(account)))
    .sort((a, b) => Number(b.kind === "fonds_euros") - Number(a.kind === "fonds_euros"));
}

/** Champs d'un arbitrage : support cédé et reçu, quantités, valeur de l'échange, frais. */
export function ArbitrageFields({ d, patch, err, account, choices, fromFund, toFund }: { d: ArbitrageDraft; patch: (p: Partial<ArbitrageDraft>) => void; err: (f: string) => string | null; account: Account | undefined; choices: Asset[]; fromFund: boolean; toFund: boolean }) {
  const set = <K extends keyof ArbitrageDraft>(k: K, v: ArbitrageDraft[K]) => patch({ [k]: v } as Partial<ArbitrageDraft>);
  return (
    <FormGrid>
      <Field label="Support cédé" error={err("assetId")}>
        {(id) => (
          <Select id={id} value={d.assetId ?? ""} onChange={(e) => patch({ assetId: e.target.value || null, quantity: null })}>
            <option value="">Choisir…</option>
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {ASSET_KIND_LABELS[a.kind]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {fromFund ? (
        <div />
      ) : (
        <Field label="Quantité cédée" error={err("quantity")}>
          {(id) => <NumberInput id={id} decimals={8} value={d.quantity} onChange={(v) => set("quantity", v)} />}
        </Field>
      )}
      <Field label="Support reçu" error={err("counterAssetId")}>
        {(id) => (
          <Select id={id} value={d.counterAssetId ?? ""} onChange={(e) => patch({ counterAssetId: e.target.value || null, counterQuantity: null })}>
            <option value="">Choisir…</option>
            {choices.filter((a) => a.id !== d.assetId).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {ASSET_KIND_LABELS[a.kind]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {toFund ? (
        <div />
      ) : (
        <Field label="Quantité reçue" error={err("counterQuantity")}>
          {(id) => <NumberInput id={id} decimals={8} value={d.counterQuantity} onChange={(v) => set("counterQuantity", v)} />}
        </Field>
      )}
      <Field
        label="Valeur de l'échange"
        error={err("amount")}
        help={account?.kind === "crypto" ? "En euros, au moment de l'échange. Elle fixe le prix de revient de la crypto reçue ; rien n'est imposable tant que vous restez en crypto." : "En euros, telle qu'indiquée sur l'avis d'arbitrage. Elle fixe le prix de revient du support reçu."}
      >
        {(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => set("amount", v)} />}
      </Field>
      <Field label="dont frais" error={err("fee")} help={toFund ? "Déduits du montant reçu sur le fonds euros." : "Compris dans le prix de revient du support reçu."}>
        {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => patch({ fee: v, feeManual: v != null })} />}
      </Field>
    </FormGrid>
  );
}
