# Analyzing Security Findings

Scanalyzer provides powerful tools to help you understand, prioritize, and act on security findings from multiple scanning tools. This guide covers everything you need to know about analyzing findings effectively.

## Understanding the Findings View

### Main Interface

![Findings Interface](../../images/screenshots/findings-main.png)

The Findings view consists of several key components:

1. **Search Bar**: Full-text search across all finding fields
2. **Filter Panel**: Advanced filtering options
3. **Findings Table**: Sortable, paginated list of findings
4. **Detail Panel**: In-depth view of selected finding
5. **Action Toolbar**: Bulk operations and export options

## Searching for Findings

### Quick Search

The search bar supports multiple search types:

- **Text Search**: Search across titles, descriptions, and details
  ```
  SQL injection
  ```

- **Field-Specific Search**: Target specific fields
  ```
  severity:critical
  tool:bandit
  category:security
  ```

- **Combined Searches**: Use AND/OR logic
  ```
  severity:high AND tool:checkov
  password OR credential
  ```

### Search Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `:` | Field match | `severity:critical` |
| `"` | Exact phrase | `"SQL injection"` |
| `AND` | Both terms | `high AND database` |
| `OR` | Either term | `password OR token` |
| `NOT` | Exclude term | `NOT false-positive` |
| `*` | Wildcard | `auth*` |

## Using Filters

### Basic Filters

![Filter Panel](../../images/screenshots/filter-panel.png)

1. **Severity Filter**
   - Critical: Immediate action required
   - High: Should be addressed soon
   - Medium: Plan to fix
   - Low: Consider fixing
   - Info: Informational only

2. **Tool Filter**
   - Select one or multiple tools
   - Shows count for each tool

3. **Date Range**
   - Preset ranges: Today, This Week, This Month
   - Custom date picker for specific ranges

4. **Status Filter**
   - New: Unreviewed findings
   - In Progress: Being addressed
   - Resolved: Fixed
   - False Positive: Marked as not applicable

### Advanced Filters

Click "Advanced Filters" to access additional options:

- **Category**: Filter by finding category (e.g., Authentication, Cryptography)
- **File Path**: Filter by affected files
- **Confidence**: Tool's confidence in the finding
- **Effort**: Estimated fix effort
- **Custom Tags**: User-defined tags

### Saving Filter Sets

Frequently used filter combinations can be saved:

1. Apply desired filters
2. Click "Save Filter Set"
3. Name your filter set
4. Access saved filters from dropdown menu

Example saved filters:
- "Critical Production Issues"
- "This Sprint's Work"
- "Python Security Findings"

## Sorting and Grouping

### Column Sorting

Click any column header to sort:
- First click: Ascending order
- Second click: Descending order
- Third click: Remove sort

Multi-column sorting:
- Hold `Shift` and click additional columns
- Sort priority shown by numbers

### Grouping Options

Group findings for better organization:

1. **Group by Severity**
   ```
   ▼ Critical (15)
     - SQL Injection in login.py
     - Hardcoded password in config.js
   ▼ High (47)
     - Missing authentication check
     - Insecure random number generation
   ```

2. **Group by Tool**
   ```
   ▼ Bandit (32)
     - B105: Hardcoded password
     - B201: Flask debug mode
   ▼ Checkov (28)
     - CKV_AWS_23: S3 bucket logging
     - CKV_AWS_46: SNS topic encryption
   ```

3. **Group by Category**
   ```
   ▼ Authentication (18)
     - Missing MFA enforcement
     - Weak password policy
   ▼ Encryption (24)
     - Unencrypted data at rest
     - Weak cipher usage
   ```

## Finding Details

### Detail View

Click any finding to open the detail panel:

![Finding Detail](../../images/screenshots/finding-detail.png)

**Information Displayed:**
- Full description and remediation guidance
- Affected file with line numbers
- Code snippet with syntax highlighting
- OWASP/CWE references
- Tool-specific metadata
- History and comments

### Code Context

View the vulnerable code with context:

```python
# Line 45-50 in app/auth.py
def authenticate_user(username, password):
    # WARNING: SQL Injection vulnerability
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    result = db.execute(query)  # <- Vulnerable line
    return result
```

### Remediation Guidance

Each finding includes:
1. **What's Wrong**: Clear explanation of the issue
2. **Why It Matters**: Security impact
3. **How to Fix**: Step-by-step remediation
4. **Example**: Secure code example
5. **References**: Links to documentation

## Bulk Operations

### Selecting Multiple Findings

- **Individual Selection**: Click checkboxes
- **Range Selection**: Shift-click to select range
- **Select All**: Click header checkbox
- **Smart Selection**: Right-click for context menu
  - "Select all Critical"
  - "Select all from this tool"
  - "Select similar findings"

### Bulk Actions

With findings selected, use the action toolbar:

1. **Update Status**
   - Mark as Resolved
   - Mark as False Positive
   - Mark as In Progress

2. **Assign**
   - Assign to team member
   - Set priority
   - Add to sprint

3. **Export**
   - Export selected to CSV
   - Create report from selection
   - Copy to clipboard

4. **Tag**
   - Add tags
   - Remove tags
   - Create new tag

## Analyzing Patterns

### Trend Analysis

Identify patterns in your findings:

1. **By Time**
   - Are certain issues increasing?
   - What's the fix rate?
   - Time to resolution trends

2. **By Component**
   - Which modules have most issues?
   - Common vulnerable patterns
   - Technical debt hotspots

3. **By Developer**
   - Training opportunities
   - Code review focus areas

### Using the Analytics Dashboard

Navigate to Dashboard > Analytics for visual insights:

- **Heat Map**: Shows finding density by file/module
- **Trend Lines**: Finding counts over time
- **Fix Rate**: Resolution velocity
- **Mean Time to Fix**: Average remediation time

## Creating Finding Reports

### Quick Reports

Generate reports from current view:

1. Apply desired filters
2. Click "Generate Report"
3. Choose format:
   - **Executive Summary**: High-level for management
   - **Technical Detail**: Full details for developers
   - **Compliance**: Formatted for auditors

### Custom Reports

Build custom reports:

1. Select findings to include
2. Choose report sections:
   - Summary statistics
   - Finding details
   - Remediation timeline
   - Risk matrix
3. Add custom notes
4. Export to PDF/DOCX

## Workflow Integration

### Status Workflow

Typical finding lifecycle:

```
New → In Review → Assigned → In Progress → Testing → Resolved
                     ↓
                False Positive
```

### Integration with Issue Trackers

Export findings to your issue tracking system:

1. Select findings
2. Click "Create Issues"
3. Choose platform:
   - JIRA
   - GitHub Issues
   - GitLab Issues
   - Azure DevOps

### Notifications

Set up alerts for:
- New critical findings
- Status changes
- Assignment updates
- SLA breaches

## Best Practices

### Daily Workflow

1. **Morning Review**
   - Check new findings
   - Review critical issues
   - Plan day's work

2. **Continuous Monitoring**
   - Keep dashboard visible
   - Set up notifications
   - Regular status updates

3. **End of Day**
   - Update finding statuses
   - Document progress
   - Plan next steps

### Team Collaboration

- **Comments**: Add context to findings
- **Mentions**: @mention team members
- **Assignments**: Clear ownership
- **Tags**: Organize by project/sprint

### Finding Prioritization

Consider these factors:
1. **Severity**: Critical > High > Medium > Low
2. **Exploitability**: How easy to exploit?
3. **Impact**: What's at risk?
4. **Effort**: How hard to fix?
5. **Dependencies**: What else is affected?

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | `/` or `Ctrl+F` |
| Clear filters | `Ctrl+Shift+F` |
| Select all | `Ctrl+A` |
| Export | `Ctrl+E` |
| Toggle details | `Space` |
| Next finding | `J` or `↓` |
| Previous finding | `K` or `↑` |
| Open finding | `Enter` |
| Toggle selection | `X` |

## Tips and Tricks

1. **Quick Filters**
   - Right-click any value to filter by it
   - Double-click severity badges for quick filter

2. **Keyboard Navigation**
   - Use `Tab` to move between sections
   - `Esc` to close panels

3. **Custom Columns**
   - Right-click column headers
   - Choose which columns to display
   - Drag to reorder

4. **Finding Templates**
   - Save common remediation notes
   - Create finding response templates

## Next Steps

- Learn about [Exporting Data](exporting-data.md)
- Set up [Automated Workflows](../advanced/automation.md)
- Configure [Custom Categories](../advanced/custom-categories.md)
- Explore [API Integration](../../api-reference/api-usage.md)

---

For additional help, visit our [Support Center](https://support.scanalyzer.app) or check the [FAQ](../troubleshooting/faq.md).