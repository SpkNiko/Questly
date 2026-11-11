
const SUPABASE_URL = "https://gosxbdbahrqcibsuwekq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CkuGwouQJi1V1BBpwi-1lQ_7UcQUOyY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let authMode = "register";
let currentPhone = "";
let verifiedUser = null;

function status(message, error = false) {
  $("status").textContent = message;
  $("status").style.color = error ? "#ff9caa" : "#d7c8ff";
}

function showForm(id) {
  ["phoneForm", "codeForm", "usernameForm"].forEach(form => {
    $(form).classList.toggle("hidden", form !== id);
  });
}

function setMode(mode) {
  authMode = mode;
  $("registerTab").classList.toggle("active", mode === "register");
  $("loginTab").classList.toggle("active", mode === "login");
  showForm("phoneForm");
  status("");
}

$("registerTab").addEventListener("click", () => setMode("register"));
$("loginTab").addEventListener("click", () => setMode("login"));

$("phoneForm").addEventListener("submit", async event => {
  event.preventDefault();

  currentPhone = $("phone").value.trim();

  if (!/^\+[1-9]\d{7,14}$/.test(currentPhone)) {
    return status("Wpisz numer w formacie +48123456789.", true);
  }

  $("sendCodeButton").disabled = true;
  status("Wysyłanie kodu...");

  const { error } = await supabaseClient.auth.signInWithOtp({
    phone: currentPhone,
    options: {
      shouldCreateUser: authMode === "register"
    }
  });

  $("sendCodeButton").disabled = false;

  if (error) return status(error.message, true);

  showForm("codeForm");
  status("Kod SMS został wysłany. Wpisz 6 cyfr.");
});

$("codeForm").addEventListener("submit", async event => {
  event.preventDefault();

  const token = $("code").value.trim();

  if (!/^\d{6}$/.test(token)) {
    return status("Kod musi mieć 6 cyfr.", true);
  }

  status("Sprawdzanie kodu...");

  const { data, error } = await supabaseClient.auth.verifyOtp({
    phone: currentPhone,
    token,
    type: "sms"
  });

  if (error) return status(error.message, true);

  verifiedUser = data.user;

  const { data: profile, error: profileError } =
    await supabaseClient
      .from("profiles")
      .select("username")
      .eq("id", verifiedUser.id)
      .maybeSingle();

  if (profileError) return status(profileError.message, true);

  if (profile?.username) {
    showForm("phoneForm");
    status("Zalogowano! Ekran główny będzie kolejnym etapem.");
  } else {
    showForm("usernameForm");
    status("Numer potwierdzony. Wybierz swój nick.");
  }
});

$("usernameForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!verifiedUser) {
    return status("Najpierw potwierdź numer telefonu.", true);
  }

  const username = $("username").value.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return status("Nick: 3–20 znaków, małe litery, cyfry i _.", true);
  }

  status("Zapisywanie nicku...");

  const { error } = await supabaseClient
    .from("profiles")
    .update({ username })
    .eq("id", verifiedUser.id);

  if (error) {
    if (error.code === "23505") {
      return status("Ten nick jest już zajęty.", true);
    }
    return status(error.message, true);
  }

  showForm("phoneForm");
  status("Konto utworzone! Następny etap to ekran główny Questly.");
});

// Blokada zwykłej strony internetowej
let installPrompt = null;

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

if (!isStandalone) {
  $("installWall").classList.remove("hidden");
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
});

$("installButton").addEventListener("click", async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else {
    $("installHelp").textContent =
      /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? "Safari → Udostępnij → Dodaj do ekranu początkowego."
        : "Chrome → menu ⋮ → Zainstaluj aplikację.";
  }
});

// Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
    }
