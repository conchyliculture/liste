(function () {
    "use strict";

    const SESSION_ID  = document.body.dataset.session;
    const RAYON_ORDER = JSON.parse(document.body.dataset.rayons);
    const NICK_KEY    = "shop_nick_" + SESSION_ID;

    let nickname     = localStorage.getItem(NICK_KEY) || "";
    let editMode     = false;
    let currentState = null;

    // ── Nickname gate ─────────────────────────────────────────────────────────

    function showNicknameGate() {
        document.getElementById("nickname-gate").hidden = false;
        document.getElementById("nickname-input").focus();
    }

    function confirmNickname() {
        var val = document.getElementById("nickname-input").value.trim();
        if (!val) return;
        nickname = val;
        localStorage.setItem(NICK_KEY, nickname);
        document.getElementById("nickname-gate").hidden = true;
        document.getElementById("shop-nick").textContent = nickname;
        startPush();
    }

    document.getElementById("nickname-ok").addEventListener("click", confirmNickname);
    document.getElementById("nickname-input").addEventListener("keydown", function (e) {
        if (e.key === "Enter") confirmNickname();
    });

    // ── Edit mode toggle ──────────────────────────────────────────────────────

    document.getElementById("edit-toggle").addEventListener("click", function () {
        editMode = !editMode;
        this.setAttribute("aria-pressed", editMode);
        document.getElementById("add-item-panel").hidden = !editMode;
        if (currentState) render(currentState);
    });

    // ── Add item ──────────────────────────────────────────────────────────────

    document.getElementById("add-submit").addEventListener("click", function () {
        var name  = document.getElementById("add-name").value.trim();
        var qty   = document.getElementById("add-qty").value.trim();
        var rayon = document.getElementById("add-rayon").value || "Épicerie";
        if (!name) return;
        document.getElementById("add-name").value = "";
        document.getElementById("add-qty").value  = "";
        if (currentState) {
            upsertOverride(currentState.overrides,
                {item_name: name, rayon: rayon, qty_display: qty, is_deleted: false, created_by: nickname});
            render(currentState);
        }
        apiPost("/shop/" + SESSION_ID + "/override",
            {item_name: name, rayon: rayon, qty_display: qty, is_deleted: false, nickname: nickname});
    });

    // ── API helpers ───────────────────────────────────────────────────────────

    function apiPost(url, body) {
        return fetch(url, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
        });
    }

    function upsertOverride(overrides, entry) {
        var idx = overrides.findIndex(function (o) { return o.item_name === entry.item_name; });
        if (idx >= 0) { overrides[idx] = entry; } else { overrides.push(entry); }
    }

    function toggleCheck(itemName) {
        if (currentState) {
            var idx = currentState.checked.findIndex(function (c) { return c.item_name === itemName; });
            if (idx >= 0) {
                currentState.checked.splice(idx, 1);
            } else {
                currentState.checked.push({item_name: itemName, checked_by: nickname});
            }
            render(currentState);
        }
        apiPost("/shop/" + SESSION_ID + "/check", {item_name: itemName, nickname: nickname});
    }

    function deleteItem(itemName) {
        if (currentState) {
            upsertOverride(currentState.overrides,
                {item_name: itemName, is_deleted: true, created_by: nickname});
            render(currentState);
        }
        apiPost("/shop/" + SESSION_ID + "/override",
            {item_name: itemName, is_deleted: true, nickname: nickname});
    }

    // ── Event delegation ──────────────────────────────────────────────────────

    document.getElementById("shop-list").addEventListener("click", function (e) {
        var del = e.target.closest(".delete-btn");
        if (del) {
            e.stopPropagation();
            deleteItem(del.dataset.name);
            return;
        }
        var li = e.target.closest(".shop-item");
        if (li) toggleCheck(li.dataset.name);
    });

    // ── Rendering ─────────────────────────────────────────────────────────────

    function esc(s) {
        return String(s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function render(state) {
        currentState = state;

        document.getElementById("shop-label").textContent = state.label || "Liste de courses";

        var shoppers = state.shoppers || [];
        document.getElementById("shop-shoppers").textContent = shoppers.map(function (n) {
            return n === nickname ? n + " (vous)" : n;
        }).join(" · ");

        var checkedMap = {};
        state.checked.forEach(function (c) { checkedMap[c.item_name] = c.checked_by; });

        var deletedSet  = new Set();
        var addedItems  = [];
        state.overrides.forEach(function (o) {
            if (o.is_deleted) {
                deletedSet.add(o.item_name);
            } else {
                addedItems.push({rayon: o.rayon || "Épicerie", name: o.item_name,
                    qty_display: o.qty_display, added: true});
            }
        });

        var baseNames = new Set(state.items.map(function (i) { return i.name; }));
        var allItems  = state.items
            .filter(function (i) { return !deletedSet.has(i.name); })
            .concat(addedItems.filter(function (i) { return !deletedSet.has(i.name) && !baseNames.has(i.name); }));

        var byRayon = {};
        allItems.forEach(function (item) {
            var r = item.rayon || "Épicerie";
            if (!byRayon[r]) byRayon[r] = [];
            byRayon[r].push(item);
        });

        var total = allItems.length;
        var done  = allItems.filter(function (i) { return checkedMap[i.name]; }).length;
        document.getElementById("progress-bar").style.width = total ? (100 * done / total) + "%" : "0%";

        var rayons = RAYON_ORDER.filter(function (r) { return byRayon[r]; });
        Object.keys(byRayon).forEach(function (r) { if (!RAYON_ORDER.includes(r)) rayons.push(r); });

        var html = "";
        rayons.forEach(function (rayon) {
            html += '<div class="shop-rayon"><h3 class="shop-rayon-header">' + esc(rayon) + '</h3><ul>';
            byRayon[rayon].forEach(function (item) {
                var isChecked  = Boolean(checkedMap[item.name]);
                var checker    = checkedMap[item.name] || "";
                var addedClass = item.added ? " added-item" : "";
                html += '<li class="shop-item' + (isChecked ? " checked" : "") + addedClass + '"'
                      + ' data-name="' + esc(item.name) + '">'
                      + '<span class="shop-check-icon">' + (isChecked ? "✓" : "") + '</span>'
                      + '<span class="shop-name">' + esc(item.name) + '</span>';
                if (item.qty_display) {
                    html += '<span class="shop-qty">' + esc(item.qty_display) + '</span>';
                }
                if (checker) {
                    html += '<span class="shop-checker">' + esc(checker) + '</span>';
                }
                if (editMode) {
                    html += '<button class="delete-btn" data-name="' + esc(item.name) + '"'
                          + ' title="Supprimer">🗑</button>';
                }
                html += '</li>';
            });
            html += '</ul></div>';
        });

        if (!html) html = '<p class="empty-msg">La liste est vide.</p>';
        document.getElementById("shop-list").innerHTML = html;
    }

    // ── Push (long poll) ──────────────────────────────────────────────────────

    function startPush() {
        fetch("/shop/" + SESSION_ID + "/state", {cache: "no-store"})
            .then(function (r) { return r.json(); })
            .then(function (state) { render(state); });

        function connect() {
            fetch("/shop/" + SESSION_ID + "/events?nickname=" + encodeURIComponent(nickname),
                  {cache: "no-store"})
                .then(function (r) { return r.json(); })
                .then(function (state) { render(state); connect(); })
                .catch(function () { setTimeout(connect, 2000); });
        }
        connect();
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    if (nickname) {
        document.getElementById("shop-nick").textContent = nickname;
        startPush();
    } else {
        showNicknameGate();
    }
})();
