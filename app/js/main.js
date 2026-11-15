/* Site Launcher — основна логика */
(function () {
    var KEY = {
        LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
        BACK: 10009, EXIT: 10182,
        RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406
    };

    var screen = 'home';
    var editingId = null;
    var loadTimer = null;
    var currentSite = null;

    function $(id) { return document.getElementById(id); }

    function show(name) {
        ['home', 'editor', 'settings', 'viewer'].forEach(function (s) {
            $(s).classList.toggle('hidden', s !== name);
        });
        screen = name;
    }

    function toast(msg) {
        var t = $('toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2500);
    }

    function exitApp() {
        try { tizen.application.getCurrentApplication().exit(); }
        catch (e) { window.close(); }
    }

    function registerKeys() {
        try {
            ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause']
                .forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} });
        } catch (e) {}
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // ---------- Начален екран ----------
    function renderHome(focusIndex) {
        var sites = Store.sites();
        var auto = Store.settings().autostart;
        $('tiles').innerHTML = sites.map(function (s) {
            return '<div class="tile" data-id="' + esc(s.id) + '">' +
                '<div class="name">' + esc(s.name) + '</div>' +
                '<div class="url">' + esc(s.url) + '</div>' +
                '<div class="badge">' + (s.mode === 'navigate' ? 'директно' : 'вграден') +
                (auto === s.id ? ' · при стартиране' : '') + '</div></div>';
        }).join('');
        $('empty').classList.toggle('hidden', sites.length > 0);
        show('home');
        Nav.set($('tiles').querySelectorAll('.tile'), focusIndex || 0);
    }

    function selectedSite() {
        var el = Nav.current();
        return el && el.dataset && el.dataset.id ? Store.get(el.dataset.id) : null;
    }

    // ---------- Редактор ----------
    function openEditor(site) {
        editingId = site ? site.id : null;
        $('editor-title').textContent = site ? 'Редакция' : 'Нов сайт';
        $('f-name').value = site ? site.name : '';
        $('f-url').value = site ? site.url : 'https://';
        $('f-mode').value = site ? site.mode : 'iframe';
        $('f-error').textContent = '';
        show('editor');
        Nav.set(document.querySelectorAll('#editor .nav'), 0);
    }

    function normalizeUrl(u) {
        u = u.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        try {
            var parsed = new URL(u);
            if (!parsed.hostname || parsed.hostname.indexOf('.') < 0) return null;
            return parsed.href;
        } catch (e) { return null; }
    }

    function saveEditor() {
        var name = $('f-name').value.trim();
        var url = normalizeUrl($('f-url').value);
        if (!url) { $('f-error').textContent = 'Невалиден адрес.'; return; }
        if (!name) name = new URL(url).hostname;
        Store.upsert({ id: editingId, name: name, url: url, mode: $('f-mode').value });
        toast('Запазено');
        renderHome(Store.sites().length - 1);
    }

    // ---------- Настройки ----------
    function openSettings() {
        var s = Store.settings();
        $('s-autostart').innerHTML = '<option value="">Няма (показвай списъка)</option>' +
            Store.sites().map(function (x) {
                return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>';
            }).join('');
        $('s-autostart').value = s.autostart || '';
        $('s-timeout').value = String(s.timeout || 15);
        show('settings');
        Nav.set(document.querySelectorAll('#settings .nav'), 0);
    }

    function saveSettings() {
        Store.setSettings({
            autostart: $('s-autostart').value,
            timeout: parseInt($('s-timeout').value, 10) || 15
        });
        toast('Настройките са запазени');
        renderHome();
    }

    // ---------- Отваряне на сайт ----------
    function openSite(site) {
        if (!site) return;
        currentSite = site;
        if (site.mode === 'navigate') { window.location.href = site.url; return; }

        var frame = $('frame');
        var loaded = false;
        $('loading').classList.remove('hidden');
        $('loading-text').textContent = 'Зареждане на ' + site.name + '…';
        $('loading-hint').textContent = 'BACK — към списъка';
        show('viewer');

        frame.onload = function () {
            if (frame.src === 'about:blank') return;
            loaded = true;
            clearTimeout(loadTimer);
            $('loading').classList.add('hidden');
            frame.focus();
        };
        frame.src = site.url;

        clearTimeout(loadTimer);
        loadTimer = setTimeout(function () {
            if (loaded) return;
            $('loading-text').textContent = 'Сайтът не позволява вграждане или не отговаря.';
            $('loading-hint').textContent = 'ENTER — отвори директно · BACK — към списъка';
        }, (Store.settings().timeout || 15) * 1000);
    }

    function closeViewer() {
        clearTimeout(loadTimer);
        $('frame').src = 'about:blank';
        var idx = Store.sites().indexOf(currentSite);
        renderHome(idx >= 0 ? idx : 0);
    }

    // ---------- Бутони ----------
    function activate() {
        var el = Nav.current();
        if (!el) return;
        if (screen === 'home') return openSite(selectedSite());
        if (el.tagName === 'BUTTON') return el.click();
        // INPUT / SELECT получават фокус; Tizen показва клавиатурата при ENTER
        el.focus();
        if (el.tagName === 'SELECT') {
            el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
        }
    }

    document.addEventListener('keydown', function (e) {
        var k = e.keyCode;

        if (k === KEY.EXIT) return exitApp();

        if (screen === 'viewer') {
            if (k === KEY.BACK) { e.preventDefault(); closeViewer(); }
            else if (k === KEY.ENTER && !$('loading').classList.contains('hidden')) {
                window.location.href = currentSite.url;
            }
            return; // останалите бутони отиват към сайта
        }

        var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
        if (typing && (k === KEY.LEFT || k === KEY.RIGHT)) return; // движение на курсора в полето

        switch (k) {
            case KEY.LEFT: e.preventDefault(); Nav.move(-1, 0); break;
            case KEY.RIGHT: e.preventDefault(); Nav.move(1, 0); break;
            case KEY.UP: e.preventDefault(); Nav.move(0, -1); break;
            case KEY.DOWN: e.preventDefault(); Nav.move(0, 1); break;
            case KEY.ENTER:
                if (typing) { Nav.move(0, 1); e.preventDefault(); }
                else { e.preventDefault(); activate(); }
                break;
            case KEY.BACK:
                e.preventDefault();
                if (screen === 'home') exitApp(); else renderHome();
                break;
            case KEY.RED:
                if (screen === 'home') openEditor(null);
                break;
            case KEY.GREEN:
                if (screen === 'home' && selectedSite()) openEditor(selectedSite());
                break;
            case KEY.YELLOW:
                if (screen === 'home' && selectedSite()) {
                    var i = Nav.index();
                    Store.remove(selectedSite().id);
                    toast('Изтрито');
                    renderHome(Math.max(i - 1, 0));
                }
                break;
            case KEY.BLUE:
                if (screen === 'home') openSettings();
                break;
        }
    });

    // Мишка/показалец (Smart Remote)
    document.addEventListener('click', function (e) {
        var tile = e.target.closest && e.target.closest('.tile');
        if (tile && screen === 'home') openSite(Store.get(tile.dataset.id));
    });

    $('f-save').onclick = saveEditor;
    $('f-cancel').onclick = function () { renderHome(); };
    $('s-save').onclick = saveSettings;
    $('s-back').onclick = function () { renderHome(); };
    $('s-reset').onclick = function () { Store.reset(); toast('Данните са изчистени'); renderHome(); };

    window.addEventListener('load', function () {
        registerKeys();
        var auto = Store.settings().autostart;
        var site = auto ? Store.get(auto) : null;
        if (site) openSite(site); else renderHome();
    });
})();
