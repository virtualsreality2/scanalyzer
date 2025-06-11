"""Pattern matching and extraction utilities for document parsers."""

import re
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import logging

from app.models.finding import SeverityLevel

logger = logging.getLogger(__name__)


# Common regex patterns for security findings
FINDING_PATTERNS = {
    # Severity indicators
    'severity_critical': re.compile(
        r'\b(critical|severe|emergency|p0|priority\s*0|cvss\s*[:]?\s*[89]\.\d+|cvss\s*[:]?\s*10\.0)\b',
        re.IGNORECASE
    ),
    'severity_high': re.compile(
        r'\b(high|important|p1|priority\s*1|cvss\s*[:]?\s*[67]\.\d+)\b',
        re.IGNORECASE
    ),
    'severity_medium': re.compile(
        r'\b(medium|moderate|p2|priority\s*2|cvss\s*[:]?\s*[34]\.\d+)\b',
        re.IGNORECASE
    ),
    'severity_low': re.compile(
        r'\b(low|minor|informational|info|p3|p4|priority\s*[34]|cvss\s*[:]?\s*[012]\.\d+)\b',
        re.IGNORECASE
    ),
    
    # Finding indicators
    'finding_start': re.compile(
        r'^(?P<severity>critical|high|medium|low|info|informational)\s*[:\-\s]+\s*(?P<title>.+?)(?:\s*[\-:]\s*(?P<desc>.+))?$',
        re.IGNORECASE | re.MULTILINE
    ),
    
    # Security terms
    'vulnerability': re.compile(
        r'\b(vulnerability|vuln|weakness|flaw|exposure|risk|threat|attack|exploit)\b',
        re.IGNORECASE
    ),
    
    # Common vulnerability types
    'sql_injection': re.compile(r'\b(sql\s*injection|sqli)\b', re.IGNORECASE),
    'xss': re.compile(r'\b(cross[\-\s]*site[\-\s]*scripting|xss)\b', re.IGNORECASE),
    'csrf': re.compile(r'\b(cross[\-\s]*site[\-\s]*request[\-\s]*forgery|csrf|xsrf)\b', re.IGNORECASE),
    'rce': re.compile(r'\b(remote\s*code\s*execution|rce|code\s*injection)\b', re.IGNORECASE),
    'auth_bypass': re.compile(r'\b(auth[a-z]*\s*bypass|authentication\s*bypass)\b', re.IGNORECASE),
    'injection': re.compile(r'\b(injection|inject)\b', re.IGNORECASE),
    'hardcoded': re.compile(r'\b(hard[\-\s]*coded|hardcoded)\s*(password|credential|secret|key)\b', re.IGNORECASE),
    
    # File/resource references
    'file_reference': re.compile(r'\b([a-zA-Z0-9_\-]+\.(php|py|js|java|cs|cpp|c|rb|go|rs|asp|jsp))\b'),
    'line_number': re.compile(r'\b(line|ln)\s*[#:]?\s*(\d+)\b', re.IGNORECASE),
    
    # Standards references
    'cwe': re.compile(r'\b(cwe[\-\s]?\d+)\b', re.IGNORECASE),
    'cve': re.compile(r'\b(cve[\-\s]?\d{4}[\-\s]?\d+)\b', re.IGNORECASE),
    'owasp': re.compile(r'\b(owasp\s*top\s*\d+|a\d{1,2}:\d{4})\b', re.IGNORECASE),
}

# Severity keyword mappings
SEVERITY_KEYWORDS = {
    SeverityLevel.CRITICAL: [
        'critical', 'severe', 'emergency', 'urgent', 'p0', 'priority 0',
        'catastrophic', 'extreme', 'highest'
    ],
    SeverityLevel.HIGH: [
        'high', 'important', 'significant', 'major', 'p1', 'priority 1',
        'serious', 'elevated'
    ],
    SeverityLevel.MEDIUM: [
        'medium', 'moderate', 'intermediate', 'p2', 'priority 2',
        'standard', 'normal'
    ],
    SeverityLevel.LOW: [
        'low', 'minor', 'informational', 'info', 'p3', 'p4',
        'priority 3', 'priority 4', 'minimal', 'trivial'
    ]
}


class PatternMatcher:
    """Extract security findings from text using regex patterns."""
    
    def extract_findings(self, text: str) -> List[Dict[str, Any]]:
        """Extract potential security findings from text."""
        findings = []
        
        # Split text into lines for line-by-line analysis
        lines = text.split('\n')
        
        # Look for finding patterns
        for i, line in enumerate(lines):
            # Check for finding start pattern
            match = FINDING_PATTERNS['finding_start'].match(line.strip())
            if match:
                finding = {
                    'severity': match.group('severity').upper(),
                    'title': match.group('title').strip(),
                    'description': match.group('desc').strip() if match.group('desc') else '',
                    'line_in_text': i + 1
                }
                
                # Look for additional context in next few lines
                context_lines = []
                for j in range(i + 1, min(i + 5, len(lines))):
                    next_line = lines[j].strip()
                    if next_line and not FINDING_PATTERNS['finding_start'].match(next_line):
                        context_lines.append(next_line)
                    else:
                        break
                
                if context_lines and not finding['description']:
                    finding['description'] = ' '.join(context_lines)
                
                # Extract additional metadata
                self._extract_metadata(finding, line + ' ' + ' '.join(context_lines))
                findings.append(finding)
        
        # If no structured findings found, try to extract from narrative text
        if not findings:
            findings.extend(self._extract_narrative_findings(text))
        
        return findings
    
    def _extract_metadata(self, finding: Dict[str, Any], text: str) -> None:
        """Extract additional metadata from finding text."""
        # File references
        file_matches = FINDING_PATTERNS['file_reference'].findall(text)
        if file_matches:
            finding['files'] = list(set(file_matches))
        
        # Line numbers
        line_matches = FINDING_PATTERNS['line_number'].findall(text)
        if line_matches:
            finding['line_numbers'] = [int(match[1]) for match in line_matches]
        
        # CWE/CVE references
        cwe_matches = FINDING_PATTERNS['cwe'].findall(text)
        cve_matches = FINDING_PATTERNS['cve'].findall(text)
        if cwe_matches or cve_matches:
            finding['references'] = {
                'cwe': [m.upper().replace(' ', '-') for m in cwe_matches],
                'cve': [m.upper().replace(' ', '-') for m in cve_matches]
            }
        
        # Vulnerability type
        for vuln_type, pattern in [
            ('sql_injection', FINDING_PATTERNS['sql_injection']),
            ('xss', FINDING_PATTERNS['xss']),
            ('csrf', FINDING_PATTERNS['csrf']),
            ('rce', FINDING_PATTERNS['rce']),
            ('auth_bypass', FINDING_PATTERNS['auth_bypass']),
            ('hardcoded_secret', FINDING_PATTERNS['hardcoded'])
        ]:
            if pattern.search(text):
                finding['vulnerability_type'] = vuln_type
                break
    
    def _extract_narrative_findings(self, text: str) -> List[Dict[str, Any]]:
        """Extract findings from narrative/unstructured text."""
        findings = []
        sentences = re.split(r'[.!?]\s+', text)
        
        for sent in sentences:
            if FINDING_PATTERNS['vulnerability'].search(sent):
                finding = {'description': sent.strip()}
                
                # Determine severity
                for sev_level, pattern_name in [
                    (SeverityLevel.CRITICAL, 'severity_critical'),
                    (SeverityLevel.HIGH, 'severity_high'),
                    (SeverityLevel.MEDIUM, 'severity_medium'),
                    (SeverityLevel.LOW, 'severity_low')
                ]:
                    if FINDING_PATTERNS[pattern_name].search(sent):
                        finding['severity'] = sev_level.value
                        break
                else:
                    finding['severity'] = 'MEDIUM'  # Default
                
                # Extract title from sentence
                finding['title'] = self._generate_title_from_description(sent)
                
                # Extract metadata
                self._extract_metadata(finding, sent)
                
                findings.append(finding)
        
        return findings
    
    def _generate_title_from_description(self, description: str) -> str:
        """Generate a title from description text."""
        # Look for specific vulnerability types
        for vuln_type, pattern in [
            ('SQL Injection', FINDING_PATTERNS['sql_injection']),
            ('Cross-Site Scripting', FINDING_PATTERNS['xss']),
            ('CSRF', FINDING_PATTERNS['csrf']),
            ('Remote Code Execution', FINDING_PATTERNS['rce']),
            ('Authentication Bypass', FINDING_PATTERNS['auth_bypass']),
            ('Hardcoded Credentials', FINDING_PATTERNS['hardcoded'])
        ]:
            if pattern.search(description):
                # Add file reference if found
                file_match = FINDING_PATTERNS['file_reference'].search(description)
                if file_match:
                    return f"{vuln_type} in {file_match.group(0)}"
                return vuln_type
        
        # Generic title
        words = description.split()[:8]  # First 8 words
        return ' '.join(words) + ('...' if len(description.split()) > 8 else '')


class SeverityMapper:
    """Map various severity descriptions to standard levels."""
    
    def map_severity(self, severity_text: str) -> SeverityLevel:
        """Map severity text to SeverityLevel enum."""
        severity_text = severity_text.lower().strip()
        
        # Check CVSS scores
        cvss_match = re.search(r'cvss\s*[:]?\s*(\d+\.?\d*)', severity_text, re.IGNORECASE)
        if cvss_match:
            score = float(cvss_match.group(1))
            if score >= 9.0:
                return SeverityLevel.CRITICAL
            elif score >= 7.0:
                return SeverityLevel.HIGH
            elif score >= 4.0:
                return SeverityLevel.MEDIUM
            else:
                return SeverityLevel.LOW
        
        # Check priority levels
        priority_match = re.search(r'p(\d)|priority\s*(\d)', severity_text, re.IGNORECASE)
        if priority_match:
            priority = int(priority_match.group(1) or priority_match.group(2))
            if priority == 0:
                return SeverityLevel.CRITICAL
            elif priority == 1:
                return SeverityLevel.HIGH
            elif priority == 2:
                return SeverityLevel.MEDIUM
            else:
                return SeverityLevel.LOW
        
        # Check keywords
        for level, keywords in SEVERITY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in severity_text:
                    return level
        
        # Default to medium if no match
        return SeverityLevel.MEDIUM


class ConfidenceScorer:
    """Calculate confidence scores for extracted findings."""
    
    def calculate_confidence(self, finding: Dict[str, Any]) -> float:
        """Calculate confidence score for a finding (0.0 to 1.0)."""
        score = 0.0
        max_score = 0.0
        
        # Required fields
        if finding.get('title'):
            score += 0.2
        max_score += 0.2
        
        if finding.get('severity'):
            score += 0.2
        max_score += 0.2
        
        if finding.get('description'):
            score += 0.2
            # Longer descriptions are better
            desc_len = len(finding['description'])
            if desc_len > 100:
                score += 0.1
            max_score += 0.1
        max_score += 0.2
        
        # Optional but valuable fields
        if finding.get('files') or finding.get('line_numbers'):
            score += 0.15
        max_score += 0.15
        
        if finding.get('references'):
            score += 0.1
        max_score += 0.1
        
        if finding.get('vulnerability_type'):
            score += 0.1
        max_score += 0.1
        
        # Normalize to 0-1 range
        return score / max_score if max_score > 0 else 0.0


# Table header mappings for spreadsheets
TABLE_HEADER_MAPPINGS = {
    'severity': [
        'severity', 'risk', 'risk level', 'priority', 'criticality',
        'level', 'rating', 'score', 'impact'
    ],
    'title': [
        'title', 'finding', 'issue', 'vulnerability', 'name',
        'summary', 'heading', 'finding title', 'issue name'
    ],
    'description': [
        'description', 'details', 'detail', 'summary', 'explanation',
        'desc', 'finding description', 'issue description', 'notes'
    ],
    'resource': [
        'resource', 'file', 'filename', 'location', 'path',
        'affected resource', 'component', 'asset', 'target'
    ],
    'recommendation': [
        'recommendation', 'remediation', 'fix', 'solution',
        'mitigation', 'action', 'resolution', 'suggested fix'
    ],
    'references': [
        'reference', 'references', 'cwe', 'cve', 'link',
        'url', 'source', 'standard', 'compliance'
    ]
}