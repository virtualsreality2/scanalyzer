import { faker } from '@faker-js/faker';

export interface MockFinding {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: 'low' | 'medium' | 'high';
  tool: string;
  location: string;
  cvss_score?: number;
  cve_id?: string;
  references: string[];
  created_at: string;
  updated_at: string;
  status: 'open' | 'resolved' | 'false_positive';
  report_id: string;
}

export interface MockReport {
  id: string;
  filename: string;
  file_type: string;
  upload_date: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_findings: number;
  processing_time?: number;
  file_size: number;
  error_message?: string;
}

/**
 * Generate large dataset for performance testing
 */
export function generateLargeDataset(size: number): MockFinding[] {
  const reportIds = Array.from({ length: 10 }, () => faker.string.uuid());
  
  return Array.from({ length: size }, (_, i) => ({
    id: `finding-${i}`,
    title: `${faker.helpers.arrayElement(['SQL Injection', 'XSS', 'RCE', 'CSRF', 'XXE'])} - ${faker.word.noun()}`,
    description: faker.lorem.paragraphs(3),
    severity: ['low', 'medium', 'high', 'critical'][i % 4] as MockFinding['severity'],
    confidence: ['low', 'medium', 'high'][i % 3] as MockFinding['confidence'],
    tool: ['nmap', 'nessus', 'burp', 'zap', 'metasploit'][i % 5],
    location: faker.internet.url(),
    cvss_score: i % 2 === 0 ? parseFloat((Math.random() * 10).toFixed(1)) : undefined,
    cve_id: i % 3 === 0 ? `CVE-${faker.date.recent().getFullYear()}-${faker.number.int({ min: 10000, max: 99999 })}` : undefined,
    references: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.internet.url()),
    created_at: faker.date.recent({ days: 30 }).toISOString(),
    updated_at: faker.date.recent({ days: 7 }).toISOString(),
    status: faker.helpers.arrayElement(['open', 'resolved', 'false_positive']),
    report_id: faker.helpers.arrayElement(reportIds)
  }));
}

/**
 * Generate mock reports
 */
export function generateMockReports(count: number): MockReport[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    filename: faker.system.fileName({ extensionCount: 1 }),
    file_type: faker.helpers.arrayElement(['nmap', 'nessus', 'burp', 'zap', 'bandit', 'checkov']),
    upload_date: faker.date.recent({ days: 7 }).toISOString(),
    status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
    total_findings: faker.number.int({ min: 0, max: 500 }),
    processing_time: faker.number.float({ min: 0.5, max: 120, precision: 0.01 }),
    file_size: faker.number.int({ min: 1000, max: 10000000 }),
    error_message: undefined
  }));
}

/**
 * Generate findings with specific patterns for testing filters
 */
export function generatePatternedFindings(count: number): MockFinding[] {
  const findings: MockFinding[] = [];
  const patterns = [
    { title: 'SQL Injection', severity: 'critical', tool: 'burp' },
    { title: 'Cross-Site Scripting', severity: 'high', tool: 'zap' },
    { title: 'Remote Code Execution', severity: 'critical', tool: 'nessus' },
    { title: 'Local File Inclusion', severity: 'medium', tool: 'burp' },
    { title: 'XML External Entity', severity: 'high', tool: 'zap' }
  ];
  
  for (let i = 0; i < count; i++) {
    const pattern = patterns[i % patterns.length];
    findings.push({
      id: `finding-${i}`,
      title: `${pattern.title} in ${faker.word.noun()}`,
      description: faker.lorem.paragraph(),
      severity: pattern.severity as MockFinding['severity'],
      confidence: faker.helpers.arrayElement(['low', 'medium', 'high']),
      tool: pattern.tool,
      location: faker.internet.url(),
      cvss_score: pattern.severity === 'critical' ? faker.number.float({ min: 9, max: 10, precision: 0.1 }) :
                 pattern.severity === 'high' ? faker.number.float({ min: 7, max: 8.9, precision: 0.1 }) :
                 faker.number.float({ min: 4, max: 6.9, precision: 0.1 }),
      references: [faker.internet.url()],
      created_at: faker.date.recent({ days: 30 }).toISOString(),
      updated_at: faker.date.recent({ days: 7 }).toISOString(),
      status: 'open',
      report_id: faker.string.uuid()
    });
  }
  
  return findings;
}

/**
 * Generate test file objects for upload testing
 */
export function generateTestFiles(count: number = 1): File[] {
  const files: File[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = faker.helpers.arrayElement(['nmap', 'bandit', 'checkov']);
    let content: string;
    let filename: string;
    let mimeType: string;
    
    switch (type) {
      case 'nmap':
        content = `<?xml version="1.0"?>
<nmaprun scanner="nmap" version="7.92">
  <host>
    <address addr="${faker.internet.ip()}" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="80">
        <state state="open"/>
        <service name="http" product="nginx" version="1.18.0"/>
      </port>
    </ports>
  </host>
</nmaprun>`;
        filename = `nmap-scan-${i}.xml`;
        mimeType = 'text/xml';
        break;
        
      case 'bandit':
        content = JSON.stringify({
          results: [{
            code: faker.lorem.lines(3),
            confidence: 'HIGH',
            filename: faker.system.filePath(),
            issue_text: faker.lorem.sentence(),
            line_number: faker.number.int({ min: 1, max: 100 }),
            severity: 'HIGH',
            test_id: `B${faker.number.int({ min: 100, max: 999 })}`,
            test_name: faker.word.noun()
          }]
        }, null, 2);
        filename = `bandit-report-${i}.json`;
        mimeType = 'application/json';
        break;
        
      default:
        content = `Title,Severity,Description
${faker.hacker.phrase()},High,${faker.lorem.sentence()}
${faker.hacker.phrase()},Medium,${faker.lorem.sentence()}`;
        filename = `findings-${i}.csv`;
        mimeType = 'text/csv';
    }
    
    files.push(new File([content], filename, { type: mimeType }));
  }
  
  return files;
}

/**
 * Generate WebSocket message events for testing real-time updates
 */
export function generateWebSocketMessages() {
  return {
    uploadProgress: (reportId: string, progress: number) => ({
      type: 'upload_progress',
      data: { report_id: reportId, progress }
    }),
    
    uploadComplete: (reportId: string, findingsCount: number) => ({
      type: 'upload_complete',
      data: { 
        report_id: reportId, 
        findings_count: findingsCount,
        status: 'completed'
      }
    }),
    
    uploadError: (reportId: string, error: string) => ({
      type: 'upload_error',
      data: { 
        report_id: reportId, 
        error,
        status: 'failed'
      }
    }),
    
    newFinding: (finding: MockFinding) => ({
      type: 'new_finding',
      data: finding
    }),
    
    findingUpdated: (findingId: string, updates: Partial<MockFinding>) => ({
      type: 'finding_updated',
      data: { finding_id: findingId, updates }
    })
  };
}

/**
 * Generate chart data for dashboard testing
 */
export function generateChartData() {
  const days = 30;
  const endDate = new Date();
  
  return {
    severityDistribution: {
      critical: faker.number.int({ min: 5, max: 20 }),
      high: faker.number.int({ min: 20, max: 50 }),
      medium: faker.number.int({ min: 30, max: 80 }),
      low: faker.number.int({ min: 40, max: 100 })
    },
    
    trendData: Array.from({ length: days }, (_, i) => {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (days - i - 1));
      
      return {
        date: date.toISOString().split('T')[0],
        findings: faker.number.int({ min: 10, max: 100 }),
        critical: faker.number.int({ min: 0, max: 10 }),
        high: faker.number.int({ min: 5, max: 20 })
      };
    }),
    
    toolDistribution: {
      nmap: faker.number.int({ min: 20, max: 50 }),
      nessus: faker.number.int({ min: 30, max: 60 }),
      burp: faker.number.int({ min: 25, max: 55 }),
      zap: faker.number.int({ min: 15, max: 45 }),
      other: faker.number.int({ min: 10, max: 30 })
    }
  };
}

/**
 * Generate error scenarios for testing error handling
 */
export function generateErrorScenarios() {
  return {
    networkError: new Error('Network request failed'),
    
    serverError: {
      status: 500,
      statusText: 'Internal Server Error',
      data: { error: 'An unexpected error occurred' }
    },
    
    validationError: {
      status: 400,
      statusText: 'Bad Request',
      data: { 
        error: 'Validation failed',
        details: {
          file: 'Invalid file format',
          size: 'File size exceeds limit'
        }
      }
    },
    
    authError: {
      status: 401,
      statusText: 'Unauthorized',
      data: { error: 'Authentication required' }
    },
    
    rateLimitError: {
      status: 429,
      statusText: 'Too Many Requests',
      data: { 
        error: 'Rate limit exceeded',
        retry_after: 60
      }
    }
  };
}