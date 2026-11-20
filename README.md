# Header Cards

Glocke rechts in der Home-Assistant-Kopfzeile. Die Alerts stehen in einem Menü, nicht direkt in der Leiste. Eine Konfiguration gilt für jede Ansicht.

## Installation

HACS, Custom Repository `WackEarl/grok-header-cards`, Kategorie Lovelace. Danach herunterladen und den Browser-Cache leeren.

Manuell als Dashboard-Ressource:

```
/hacsfiles/grok-header-cards/lovelace-header-cards.js
```

## Konfiguration

In der Raw-Config des Dashboards, nicht als Karte auf einer Ansicht:

```yaml
header_cards:
  labels:
    - alert
    - override
  tap_action: toggle
```

`labels` zeigt Entitäten, deren Label so heißt und die `on` sind, als Chips im Mushroom-Stil (wie eine `mushroom-chips-card` mit Entity-Chips im Menü). Reihenfolge: nach Label in der angegebenen Reihenfolge, darin die zuletzt geänderte zuerst. Weitere Optionen:

- `content_info`: `name` (Standard), `state` oder `none`
- `show_empty`: `true` zeigt „keine Alerts“, wenn nichts an ist
- `chip_style`: `mushroom` (Standard) oder `list` für die alte Darstellung als volle Zeilen

Mushroom-Theme-Variablen wie `--mush-chip-background`, `--mush-chip-border-width`, `--mush-chip-border-color`, `--mush-chip-box-shadow`, `--mush-chip-font-size` und `--mush-chip-font-weight` wirken wie bei Mushroom. Höhe, Icon, Radius und Innenabstand sind wie bei gehosteten Mushroom-Chips fest (36 px, 18 px, 18 px, `0 8px`) und lassen sich über `--header-cards-chip-height`, `--header-cards-chip-icon-size`, `--header-cards-chip-border-radius` und `--header-cards-chip-padding` ändern.

Alternativ Karten, zum Beispiel Mushroom über auto-entities:

```yaml
header_cards:
  cards:
    - type: custom:auto-entities
      card:
        type: custom:mushroom-chips-card
      filter:
        include:
          - domain: input_boolean
            state: "on"
```

Ein Tippen schaltet Booleans um. Sensoren und andere Domänen ohne Toggle öffnen die Details.
