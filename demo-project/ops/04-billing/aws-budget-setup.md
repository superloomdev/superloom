# AWS Budget Setup

## Prerequisites

AWS account active.

## Steps

### Create Monthly Cost Budget

* AWS Console → Billing → Budgets → Create Budget
* Use a template (simplified) → Monthly cost budget
* Budget name: `[TODO: Project-Name] Monthly Cost Budget`
* Enter your budgeted amount ($): `[TODO: e.g., 30]`
* Email recipients: `[TODO: alert-email@example.com]`

### Configure Budget Alerts

After the budget is created:

* Adjust the 2 automatically created alerts (delete 3rd auto alert if present)
* Set Alert 1 to 80% of Actual Cost
* Set Alert 2 to 100% of Actual Cost

## Notes

- Review budget monthly and adjust as services scale
- Consider setting separate budgets per service for granular tracking
