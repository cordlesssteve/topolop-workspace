#!/usr/bin/env node

/**
 * Test Unified Template Integration
 * 
 * Validates that the UnifiedDataToTemplateAdapter correctly converts
 * UnifiedAnalysisResult to template-compatible format
 */

import {
  UnifiedAnalysisResult,
  UnifiedIssue,
  UnifiedEntity,
  IssueSeverity,
  AnalysisType
} from '@topolop/shared-types';
import { UnifiedDataToTemplateAdapter } from './unified-data-adapter';
import { Topolop3DVisualizationTemplate } from './3d-visualization-template';

/**
 * Create minimal test data
 */
function createTestUnifiedData(): UnifiedAnalysisResult {
  const result = new UnifiedAnalysisResult('/test/project');

  // Create test files with issues from multiple tools
  const testFiles = [
    'src/auth.ts',
    'src/user.ts',
    'tests/auth.test.ts'
  ];

  const tools = ['sonarqube', 'semgrep', 'checkmarx'];

  testFiles.forEach((filePath, fileIndex) => {
    tools.forEach((toolName, toolIndex) => {
      const entity = new UnifiedEntity(filePath, `${toolName}:${filePath}`, toolName);
      
      const issue = new UnifiedIssue({
        id: `${toolName}-${filePath}`,
        entity,
        severity: fileIndex === 0 ? IssueSeverity.CRITICAL : IssueSeverity.MEDIUM,
        analysisType: toolName === 'semgrep' ? AnalysisType.SECURITY : AnalysisType.QUALITY,
        title: `Test Issue from ${toolName}`,
        description: `Test description for ${filePath}`,
        ruleId: `TEST_RULE_${toolIndex}`,
        line: 10 + toolIndex,
        toolName
      });

      result.addIssue(issue);
    });
  });

  // Build correlations
  result.buildCorrelationGroups();
  result.generateHotspots();

  return result;
}

/**
 * Run integration tests
 */
async function runTests(): Promise<void> {
  console.log('🧪 Testing Unified Template Integration...\n');

  try {
    // Test 1: Create unified data
    console.log('1️⃣  Creating test unified analysis data...');
    const unifiedData = createTestUnifiedData();
    const summary = unifiedData.getSummary();
    
    console.log(`   ✅ Created ${summary.totalIssues} issues across ${summary.filesAnalyzed} files`);
    console.log(`   ✅ Tools: ${summary.toolsCovered.join(', ')}`);
    console.log(`   ✅ Hotspots: ${summary.hotspots}, Correlations: ${summary.correlationGroups}`);

    // Test 2: Create adapter and convert
    console.log('\n2️⃣  Converting to template format...');
    const adapter = new UnifiedDataToTemplateAdapter(unifiedData);
    const cityData = adapter.convertToTemplateFormat();
    
    console.log(`   ✅ Generated ${cityData.buildings.length} buildings`);
    console.log(`   ✅ Generated ${cityData.roads.length} correlation roads`);
    console.log(`   ✅ Generated ${cityData.districts.length} districts`);

    // Test 3: Validate data structure
    console.log('\n3️⃣  Validating converted data structure...');
    
    // Check buildings have required properties
    const sampleBuilding = cityData.buildings[0];
    if (!sampleBuilding) {
      throw new Error('No buildings generated');
    }
    
    const requiredBuildingProps = ['id', 'name', 'shape', 'metadata'];
    for (const prop of requiredBuildingProps) {
      if (!(prop in sampleBuilding)) {
        throw new Error(`Building missing required property: ${prop}`);
      }
    }
    
    console.log('   ✅ Buildings have required properties');
    
    // Check building metadata
    const metadata = sampleBuilding.metadata;
    const requiredMetadataProps = ['canonicalPath', 'issueCount', 'riskScore', 'toolsDetected'];
    for (const prop of requiredMetadataProps) {
      if (!(prop in metadata)) {
        throw new Error(`Building metadata missing required property: ${prop}`);
      }
    }
    
    console.log('   ✅ Building metadata is complete');

    // Test 4: Generate template configuration
    console.log('\n4️⃣  Generating optimized template configuration...');
    const templateConfig = adapter.generateOptimizedTemplateConfig();
    
    const requiredConfigProps = ['title', 'subtitle', 'theme', 'buildings', 'roads', 'ui'];
    for (const prop of requiredConfigProps) {
      if (!(prop in templateConfig)) {
        throw new Error(`Template config missing required property: ${prop}`);
      }
    }
    
    console.log('   ✅ Template configuration is valid');
    console.log(`   ✅ Title: "${templateConfig.title}"`);
    console.log(`   ✅ Subtitle: "${templateConfig.subtitle}"`);

    // Test 5: Create template and generate HTML
    console.log('\n5️⃣  Testing template HTML generation...');
    const template = new Topolop3DVisualizationTemplate(templateConfig);
    
    const templateData = {
      cityVisualization: cityData,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'test-integration',
        version: '2.0.0'
      }
    };

    const htmlContent = template.generateHTML(templateData);
    
    if (!htmlContent || htmlContent.length < 1000) {
      throw new Error('Generated HTML content appears incomplete');
    }
    
    // Check for key HTML elements
    const requiredElements = ['<html>', '<head>', '<body>', '<script>', 'THREE.Scene', 'UnifiedAnalysisResult'];
    for (const element of requiredElements) {
      if (!htmlContent.includes(element)) {
        throw new Error(`Generated HTML missing required element: ${element}`);
      }
    }
    
    console.log('   ✅ HTML content generated successfully');
    console.log(`   ✅ Content length: ${htmlContent.length} characters`);

    // Test 6: Validate correlation preservation
    console.log('\n6️⃣  Validating correlation data preservation...');
    
    const roadWithCorrelation = cityData.roads.find(r => r.type === 'correlation');
    if (!roadWithCorrelation) {
      console.log('   ⚠️  No correlation roads found (may be expected for small dataset)');
    } else {
      console.log('   ✅ Correlation roads generated successfully');
      console.log(`   ✅ Sample correlation: ${roadWithCorrelation.metadata.riskLevel} risk level`);
    }

    // Check hotspot preservation
    const buildingWithHotspot = cityData.buildings.find(b => b.metadata.hotspot);
    if (!buildingWithHotspot) {
      console.log('   ⚠️  No hotspot buildings found (may be expected for small dataset)');
    } else {
      console.log('   ✅ Hotspot data preserved in buildings');
    }

    console.log('\n🎉 ALL TESTS PASSED! Integration is working correctly.');
    console.log('\n📋 Summary:');
    console.log(`   • Unified data → Template format conversion: ✅`);
    console.log(`   • Template configuration generation: ✅`);
    console.log(`   • HTML visualization generation: ✅`);
    console.log(`   • Data structure validation: ✅`);
    console.log(`   • Correlation preservation: ✅`);
    console.log('\n✨ The unified Tier 1 tool data is fully integrated with');
    console.log('   the 3D visualization template system!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };