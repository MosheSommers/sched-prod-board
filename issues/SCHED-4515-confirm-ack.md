---
id: SCHED-4515
title: Ack asks to confirm, naming the incident
status: ready
plan: R2, R7
---

Product's decision after the ack-race in the first recording (new incident lands, rows shift, the click acks the
wrong row). New incidents stay live at the top and Ack stays on the row, but Ack opens a confirm that names the
incident id (`data-testid="confirm"`, `confirm-ack`, `confirm-cancel`).

Acceptance: clicking Ack shows "Ack INC-…?" with the id of the row clicked; Confirm sends the ack and marks the
row; Cancel and Esc send nothing.
