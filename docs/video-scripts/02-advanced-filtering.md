# Video Script: Mastering Filters and Search in Scanalyzer

**Title:** Advanced Filtering - Find Critical Issues Fast
**Duration:** 8-10 minutes
**Level:** Intermediate

## Video Outline

### Introduction (0:00-0:30)

**[SCENE: Findings page with many results]**

**Narration:**
"When you're dealing with hundreds or thousands of security findings, efficient filtering is essential. In this video, I'll show you how to use Scanalyzer's powerful search and filter capabilities to quickly identify and prioritize the issues that matter most."

**[SCENE: Preview of filtering results from 1000+ to 10 critical items]**

### Search Basics (0:30-2:00)

**[SCENE: Findings page with search bar highlighted]**

**Narration:**
"Let's start with search. The search bar uses intelligent full-text search across all finding fields."

**Actions:**
1. Type "injection"
2. Show live results updating

**Narration:**
"As I type 'injection', Scanalyzer instantly filters to show all SQL injection, command injection, and other injection-related findings."

**[SCENE: Clear search, type new query]**

**Narration:**
"You can search for specific terms in quotes for exact matches."

**Actions:**
1. Type: "hardcoded password"
2. Show results

**[SCENE: Field-specific search]**

**Narration:**
"For more precision, use field-specific searches with a colon. For example, 'severity:critical' shows only critical findings."

**Actions:**
1. Type: severity:critical
2. Show filtered results

**Narration:**
"You can search any field: tool:bandit, category:authentication, or even file paths."

### Combining Search Terms (2:00-3:00)

**[SCENE: Complex search queries]**

**Narration:**
"Combine search terms for powerful queries. Use AND to require multiple conditions."

**Actions:**
1. Type: severity:high AND tool:prowler
2. Show results

**Narration:**
"This shows only high-severity findings from Prowler. Use OR for either condition."

**Actions:**
1. Type: password OR credential OR secret
2. Show results

**Narration:**
"Perfect for finding all authentication-related issues. Use NOT to exclude terms."

**Actions:**
1. Type: severity:critical NOT test
2. Show results

**Narration:**
"This filters out any critical findings in test files, focusing on production issues."

### Visual Filters Panel (3:00-4:30)

**[SCENE: Click Filters button]**

**Narration:**
"For visual filtering, click the Filters button. This opens the filter panel with intuitive controls."

**[SCENE: Severity filter]**

**Narration:**
"The severity filter is usually your first stop. Click to toggle each severity level."

**Actions:**
1. Click Critical and High only
2. Show count updating

**Narration:**
"I'll focus on Critical and High findings - notice the count updates in real-time."

**[SCENE: Tool filter]**

**Narration:**
"Filter by security tool to focus on specific scan results."

**Actions:**
1. Select Checkov and Prowler
2. Show filtered results

**[SCENE: Date range filter]**

**Narration:**
"Use date filters to see recent findings or track issues over time."

**Actions:**
1. Select "Last 7 days"
2. Switch to custom range
3. Select specific dates

### Advanced Filter Options (4:30-6:00)

**[SCENE: Click Advanced Filters]**

**Narration:**
"Click Advanced Filters for more options. These powerful filters help you slice and dice your data precisely."

**[SCENE: Category filter]**

**Narration:**
"Filter by category to focus on specific security domains."

**Actions:**
1. Expand category list
2. Select "Encryption" and "Authentication"

**[SCENE: Status filter]**

**Narration:**
"The status filter is crucial for workflow management. See what's new, in progress, or resolved."

**Actions:**
1. Select "New" and "In Progress"
2. Show filtered results

**[SCENE: Custom tags]**

**Narration:**
"If your team uses custom tags, filter by them here. Great for sprint planning or compliance tracking."

### Saving Filter Sets (6:00-7:00)

**[SCENE: Complex filter applied]**

**Narration:**
"Once you've created a useful filter combination, save it for quick access. Let me create a filter for critical production issues."

**Actions:**
1. Set filters: Critical, High, exclude test files
2. Click "Save Filter Set"
3. Name: "Production Priorities"

**Narration:**
"Now I can apply this filter set with one click from the dropdown menu."

**[SCENE: Show saved filters dropdown]**

**Narration:**
"Your saved filters appear here. Create different sets for different workflows - sprint planning, compliance audits, or daily reviews."

### Smart Filtering Tips (7:00-8:30)

**[SCENE: Right-click context menu]**

**Narration:**
"Here's a pro tip: right-click any value in the findings table to quickly filter by it."

**Actions:**
1. Right-click on "SQL Injection"
2. Select "Filter by this value"

**[SCENE: Multi-select filtering]**

**Narration:**
"Select multiple findings and filter to show similar issues."

**Actions:**
1. Select several findings
2. Right-click > "Show similar findings"

**[SCENE: Keyboard shortcuts]**

**Narration:**
"Use keyboard shortcuts for speed:
- Slash for quick search
- Ctrl+Shift+F to clear all filters  
- Escape to close filter panel"

**Actions:**
1. Demonstrate each shortcut

### Real-World Scenarios (8:30-9:30)

**[SCENE: Scenario setup]**

**Narration:**
"Let's see these filters in action with real scenarios. First, I need to find all critical vulnerabilities in our production AWS environment."

**Actions:**
1. Type: severity:critical AND tool:prowler AND prod
2. Show results

**Narration:**
"Eight critical findings in production - these need immediate attention."

**[SCENE: Second scenario]**

**Narration:**
"Next, I want to find all hardcoded secrets that aren't marked as false positives."

**Actions:**
1. Type: (password OR key OR secret) NOT status:false-positive
2. Apply filters

**Narration:**
"Twenty-three potential secrets to review. This focused list makes security reviews much more efficient."

### Conclusion (9:30-10:00)

**[SCENE: Return to main findings view]**

**Narration:**
"Mastering Scanalyzer's search and filter capabilities transforms how you handle security findings. Instead of drowning in data, you can quickly surface the issues that need your attention."

**[SCENE: Filter tips summary]**

**Narration:**
"Remember:
- Use field-specific searches for precision
- Combine terms with AND, OR, NOT
- Save filter sets for common workflows
- Right-click for quick filtering
- Use keyboard shortcuts for speed"

**[SCENE: End card]**

**Narration:**
"In our next video, we'll explore bulk operations and automation. Thanks for watching, and happy filtering!"

## Production Notes

### Key Demonstrations
1. Show real-time result updates
2. Highlight count changes
3. Use realistic data volumes
4. Show performance with large datasets

### Visual Enhancements
1. Highlight active filters
2. Animate filter transitions
3. Use callouts for shortcuts
4. Show before/after comparisons

### Sample Data Requirements
- At least 1000 findings
- Various severity levels  
- Multiple tools represented
- Realistic finding titles
- Some with custom tags

### Common Mistakes to Address
1. Over-filtering (no results)
2. Forgetting active filters
3. Not using field-specific search
4. Ignoring saved filter sets