/* Пространствена навигация със стрелките на дистанционното */
var Nav = (function () {
    var items = [];
    var index = 0;

    function center(el) {
        var r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function set(list, start) {
        items = Array.prototype.slice.call(list);
        index = Math.min(start || 0, Math.max(items.length - 1, 0));
        render();
    }

    function render() {
        items.forEach(function (el, i) { el.classList.toggle('focused', i === index); });
        var el = items[index];
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.focus();
            else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
            if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        }
    }

    // Избира най-близкия елемент в посоката dx/dy
    function move(dx, dy) {
        if (!items.length) return;
        var from = center(items[index]);
        var best = -1, bestScore = Infinity;
        items.forEach(function (el, i) {
            if (i === index) return;
            var c = center(el);
            var vx = c.x - from.x, vy = c.y - from.y;
            var along = vx * dx + vy * dy;
            if (along <= 1) return;
            var across = Math.abs(vx * dy) + Math.abs(vy * dx);
            var score = along + across * 2;
            if (score < bestScore) { bestScore = score; best = i; }
        });
        if (best >= 0) { index = best; render(); }
    }

    return {
        set: set,
        current: function () { return items[index]; },
        index: function () { return index; },
        move: move
    };
})();
