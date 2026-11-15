/* Съхранение на сайтове и настройки в localStorage */
var Store = (function () {
    var KEY = 'siteLauncher.v1';
    var DEFAULTS = {
        sites: [
            { id: 's1', name: 'Wikipedia', url: 'https://www.wikipedia.org/', mode: 'iframe' }
        ],
        settings: { autostart: '', timeout: 15 }
    };

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    function load() {
        try {
            var raw = localStorage.getItem(KEY);
            if (raw) {
                var data = JSON.parse(raw);
                if (data && data.sites && data.settings) return data;
            }
        } catch (e) {}
        return clone(DEFAULTS);
    }

    var data = load();

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
        catch (e) { return false; }
    }

    return {
        sites: function () { return data.sites; },
        settings: function () { return data.settings; },
        get: function (id) {
            for (var i = 0; i < data.sites.length; i++) if (data.sites[i].id === id) return data.sites[i];
            return null;
        },
        upsert: function (site) {
            if (!site.id) {
                site.id = 's' + Date.now();
                data.sites.push(site);
            } else {
                for (var i = 0; i < data.sites.length; i++)
                    if (data.sites[i].id === site.id) data.sites[i] = site;
            }
            return save();
        },
        remove: function (id) {
            data.sites = data.sites.filter(function (s) { return s.id !== id; });
            if (data.settings.autostart === id) data.settings.autostart = '';
            return save();
        },
        setSettings: function (s) { data.settings = s; return save(); },
        reset: function () { data = clone(DEFAULTS); return save(); }
    };
})();
