// Applique le thème avant le premier affichage, sans attendre l'application : pas de flash clair ou sombre.
// Le serveur garde ce fichier en cache un an (nom non haché) : changer son contenu impose de le renommer
// (theme-2.js…) et de mettre à jour index.html. La logique doit rester celle de src/lib/theme.ts.
(function () {
  var choice = "systeme";
  try {
    choice = localStorage.getItem("hamac.theme") || "systeme";
  } catch (e) {
    // Navigation privée : on suit le système.
  }
  var dark = choice === "sombre" || (choice !== "clair" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.add(dark ? "dark" : "light");
})();
