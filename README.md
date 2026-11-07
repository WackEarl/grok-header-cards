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

`labels` zeigt Entitäten, deren Label so heißt und die `on` sind. Alternativ Karten, zum Beispiel Mushroom über auto-entities:

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
