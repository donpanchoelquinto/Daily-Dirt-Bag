(function () {
  "use strict";

  const root = document.body.getAttribute("data-root") || "";

  /**
   * Sign up overlay
   */
  const modal = document.getElementById("signup-modal");
  let lastFocused = null;

  const openModal = function (event) {
    if (!modal) return;
    if (event) event.preventDefault();
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    const first = modal.querySelector("input");
    if (first) first.focus();
  };

  const closeModal = function () {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  document.querySelectorAll("[data-open-signup]").forEach(function (el) {
    el.addEventListener("click", openModal);
  });

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal || event.target.closest("[data-close-modal]")) {
        closeModal();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeModal();
    });
  }

  /**
   * Smooth scroll for in-page links
   */
  document.querySelectorAll("a.scrollto").forEach(function (link) {
    link.addEventListener("click", function (event) {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /**
   * Forms: submit to the existing endpoints (which feed the Notion databases)
   * through a hidden iframe so the visitor stays on the page.
   */
  const frame = document.querySelector('iframe[name="submit-frame"]');
  let pendingForm = null;

  const setStatus = function (form, message, kind) {
    const status = form.querySelector(".form-status");
    if (!status) return;
    status.textContent = message;
    status.className = "form-status " + (kind || "");
  };

  const slug = document.body.getAttribute("data-slug");
  const storageKey = slug ? "ddb-comments:" + slug : null;

  const readLocalComments = function () {
    if (!storageKey) return [];
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (e) {
      return [];
    }
  };

  const writeLocalComment = function (comment) {
    if (!storageKey) return;
    const all = readLocalComments();
    all.push(comment);
    try {
      localStorage.setItem(storageKey, JSON.stringify(all));
    } catch (e) {
      /* storage unavailable: ignore */
    }
  };

  const commentEl = function (comment, pending) {
    const li = document.createElement("article");
    li.className = "comment" + (pending ? " comment-pending" : "");

    const head = document.createElement("div");
    head.className = "comment-head";

    const name = document.createElement("strong");
    name.textContent = comment.name;
    head.appendChild(name);

    const when = document.createElement("span");
    when.textContent = comment.date;
    head.appendChild(when);

    if (pending) {
      const badge = document.createElement("em");
      badge.textContent = "Awaiting editor approval (only you can see this)";
      head.appendChild(badge);
    }

    const body = document.createElement("p");
    body.textContent = comment.text;

    li.appendChild(head);
    li.appendChild(body);
    return li;
  };

  const renderComments = function (approved) {
    const list = document.getElementById("comment-list");
    if (!list) return;
    list.textContent = "";
    approved.forEach(function (c) {
      list.appendChild(commentEl(c, false));
    });
    readLocalComments().forEach(function (c) {
      list.appendChild(commentEl(c, true));
    });
    if (!list.children.length) {
      const empty = document.createElement("p");
      empty.className = "comments-empty";
      empty.textContent = "No comments yet. Be the first to say something unwise.";
      list.appendChild(empty);
    }
  };

  const loadComments = function () {
    if (!document.getElementById("comment-list")) return;
    fetch(root + "assets/data/comments.json", { cache: "no-cache" })
      .then(function (res) {
        return res.ok ? res.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (data) {
        renderComments((data && data[slug]) || []);
      });
  };

  document.querySelectorAll("form[data-ajax-form]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      const trap = form.querySelector(".hp-field");
      if (trap && trap.value) {
        // Bots fill the hidden field: pretend it worked, send nothing.
        event.preventDefault();
        setStatus(form, "Thanks!", "success");
        return;
      }
      pendingForm = form;
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      setStatus(form, "Sending...", "");
    });
  });

  if (frame) {
    frame.addEventListener("load", function () {
      if (!pendingForm) return; // ignore the initial blank load
      const form = pendingForm;
      pendingForm = null;

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = false;

      if (form.hasAttribute("data-comment-form")) {
        const data = new FormData(form);
        writeLocalComment({
          name: String(data.get("Name") || "Anonymous"),
          text: String(data.get("Message") || ""),
          date: new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        });
        loadComments();
        setStatus(form, "Thanks! Your comment was sent to the editors and will appear for everyone once approved.", "success");
      } else if (form.closest("#signup-modal")) {
        setStatus(form, "You're on the list. Welcome to the dirt.", "success");
      } else {
        setStatus(form, "Message sent. We'll get back to you eventually.", "success");
      }
      form.reset();
    });
  }

  loadComments();
})();
