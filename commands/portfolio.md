# /portfolio-analyzer:portfolio

Manage investment portfolios: create, add/remove tickers, list, delete.

## Usage

```
/portfolio-analyzer:portfolio <action> [args]
```

## Actions

### create
Create a new portfolio.
```
/portfolio-analyzer:portfolio create <name>
```

### add
Add a ticker to a portfolio. Automatically looks up CIK via SEC EDGAR.
```
/portfolio-analyzer:portfolio add <portfolio> <TICKER>
```

### remove
Remove a ticker from a portfolio.
```
/portfolio-analyzer:portfolio remove <portfolio> <TICKER>
```

### list
List all portfolios, or show details of a specific one.
```
/portfolio-analyzer:portfolio list [portfolio]
```

### delete
Delete a portfolio.
```
/portfolio-analyzer:portfolio delete <name>
```

## Implementation

Run the manage-portfolio.ts script with appropriate arguments:

```bash
npx tsx scripts/manage-portfolio.ts --action "<action>" --name "<name>" --portfolio "<portfolio>" --ticker "<TICKER>"
```

Parameters depend on the action:
- `create`: `--action create --name "<name>"`
- `add`: `--action add --portfolio "<name>" --ticker "<TICKER>"`
- `remove`: `--action remove --portfolio "<name>" --ticker "<TICKER>"`
- `list`: `--action list [--portfolio "<name>"]`
- `delete`: `--action delete --name "<name>"`

Parse the JSON output and present results to the user.
