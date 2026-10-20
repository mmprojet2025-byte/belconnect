// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { CatalogProvider } from "./context/CatalogContext";
import { PageBoundary } from "./components/PageBoundary";
import { result } from "./lib/auth";

const activity = {
  id: "atelier", title: "Atelier pilote", category: "art", city: "Bruxelles",
  location: "Centre", host: "Collectif", price: 0, image: "ceramique",
  startsAt: "2027-01-01T10:00:00Z", demonstration: false, description: "Un atelier.",
  details: { duration: "2 heures", audience: "Adultes", meetingPoint: "Centre", preparation: "Aucune",
    capacity: 4, remaining: 4, program: ["Créer ensemble"], included: ["Matériel"] },
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function requests(catalog: () => Promise<Response> = async () => json([], 503)) {
  vi.stubGlobal("fetch", vi.fn((input: string) => {
    if (input === "/api/activities") return catalog();
    if (input === "/api/auth/me") return Promise.resolve(json({}, 401));
    if (input === "/api/auth/csrf") return Promise.resolve(json({ headerName: "X-CSRF-TOKEN", token: "test" }));
    if (input === "/api/auth/login") return Promise.reject(new TypeError("Failed to fetch"));
    if (input === "/api/projects") return Promise.resolve(json([]));
    return Promise.resolve(json({}, 404));
  }));
}
function open(path: string) {
  window.history.replaceState(null, "", path);
  return render(<CatalogProvider><App /></CatalogProvider>);
}
beforeEach(() => { vi.stubGlobal("scrollTo", vi.fn()); requests(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Pages indépendantes du catalogue", () => {
  it.each([
    ["/connexion", "Heureux de vous retrouver"],
    ["/reinitialiser-mot-de-passe", "Mot de passe oublié ?"],
    ["/projets", "Découvrez les projets"],
    ["/informations-legales", "Confidentialité et règles de Belconnect"],
    ["/adresse-inconnue", "Cette page n’existe pas ou a été déplacée"],
    ["/projets/2/extra", "Cette page n’existe pas ou a été déplacée"],
  ])("rend %s malgré une panne activités", async (path, title) => {
    open(path);
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeTruthy();
  });
  it("laisse la connexion accessible pendant un catalogue qui ne répond pas", async () => {
    requests(() => new Promise(() => {}));
    open("/connexion");
    expect(await screen.findByRole("heading", { name: "Heureux de vous retrouver" })).toBeTruthy();
  });
  it("affiche une erreur locale puis récupère le catalogue au réessai", async () => {
    let failed = true;
    requests(async () => failed ? json({}, 503) : json([activity]));
    open("/activites");
    await screen.findByRole("button", { name: "Réessayer les activités" });
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Réessayer les activités" }));
    expect(await screen.findByRole("heading", { name: "Atelier pilote" })).toBeTruthy();
  });
  it("ouvre directement une fiche puis la retrouve après remontage", async () => {
    requests(async () => json([activity]));
    const view = open("/activites/atelier");
    expect(await screen.findByRole("heading", { name: "Atelier pilote" })).toBeTruthy();
    view.unmount();
    open("/activites/atelier");
    expect(await screen.findByRole("heading", { name: "Atelier pilote" })).toBeTruthy();
  });
  it("termine le chargement par une erreur après le délai du catalogue", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((input: string, options?: RequestInit) => {
      if (input === "/api/activities") return new Promise<Response>((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")));
      });
      return Promise.resolve(json({}, 401));
    }));
    open("/activites");
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByRole("button", { name: "Réessayer les activités" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeTruthy();
  });
  it("un échec d’actualisation conserve le formulaire et signale les données périmées", async () => {
    let failed = false;
    requests(async () => failed ? json({}, 503) : json([activity]));
    open("/activites/atelier/connexion");
    const email = await screen.findByLabelText("Adresse e-mail");
    fireEvent.change(email, { target: { value: "pilote@example.test" } });
    failed = true;
    act(() => window.dispatchEvent(new Event("catalog-refresh")));
    await waitFor(() => expect(screen.getByText(/informations affichées n’ont pas pu être actualisées/)).toBeTruthy());
    expect((screen.getByLabelText("Adresse e-mail") as HTMLInputElement).value).toBe("pilote@example.test");
  });
  it("isole une entrée invalide sans perdre les activités valides", async () => {
    requests(async () => json([activity, { id: "cassé" }]));
    open("/activites");
    expect(await screen.findByRole("heading", { name: "Atelier pilote" })).toBeTruthy();
    expect(screen.getByText("Certaines activités ne peuvent pas être affichées")).toBeTruthy();
  });
  it("ne transforme pas un catalogue entièrement invalide en catalogue vide", async () => {
    requests(async () => json([{}]));
    open("/activites");
    expect(await screen.findByRole("button", { name: "Réessayer les activités" })).toBeTruthy();
    expect(screen.queryByText("0 activités trouvées")).toBeNull();
  });
  it("conserve la saisie après une interruption pendant la connexion", async () => {
    open("/connexion");
    const email = await screen.findByLabelText("Adresse e-mail");
    const password = screen.getByLabelText("Mot de passe");
    fireEvent.change(email, { target: { value: "pilote@example.test" } });
    fireEvent.change(password, { target: { value: "Test-only-password" } });
    fireEvent.submit(email.closest("form")!);
    expect(await screen.findByText(/La réponse du serveur n’a pas été reçue/)).toBeTruthy();
    expect((email as HTMLInputElement).value).toBe("pilote@example.test");
    expect((password as HTMLInputElement).value).toBe("Test-only-password");
  });
  it("efface les anciennes activités au changement de session", async () => {
    let failed = false;
    requests(async () => failed ? json({}, 503) : json([activity]));
    open("/activites");
    await screen.findByRole("heading", { name: "Atelier pilote" });
    failed = true;
    act(() => window.dispatchEvent(new Event("catalog-reset")));
    await screen.findByRole("button", { name: "Réessayer les activités" });
    expect(screen.queryByRole("heading", { name: "Atelier pilote" })).toBeNull();
  });
});

describe("Erreurs explicites", () => {
  it.each([401, 403, 404, 409, 429, 503])("conserve le statut HTTP %s", async status => {
    await expect(result(json({}, status))).rejects.toMatchObject({ status });
  });
  it("ne confond pas refus de droits et session expirée", async () => {
    await expect(result(json({}, 403))).rejects.toThrow("Cette action n’est pas autorisée");
  });
  it("ne révèle pas un message technique de serveur", async () => {
    await expect(result(json({ message: "internal database detail" }, 500))).rejects.toThrow("momentanément indisponible");
  });
  it("remplace un plantage de rendu par un recours utilisable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never { throw Error("test"); }
    render(<><nav>Navigation conservée</nav><PageBoundary><Broken /></PageBoundary></>);
    expect(screen.getByText("Navigation conservée")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cette page ne peut pas être affichée" })).toBeTruthy();
  });
});
