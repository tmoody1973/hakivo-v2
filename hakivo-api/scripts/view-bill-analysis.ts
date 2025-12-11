/**
 * View bill_analysis table (benefits and concerns)
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';

async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${error}`);
  }

  return response.json();
}

async function viewBillAnalysis() {
  console.log(`🔍 Viewing bill_analysis for: ${BILL_ID}\n`);

  try {
    const result = await executeSQL(`
      SELECT *
      FROM bill_analysis
      WHERE bill_id = '${BILL_ID}'
    `);

    if (result.results && result.results.length > 0) {
      const analysis = result.results[0];

      console.log('📊 Analysis Record:');
      console.log('   Status:', analysis.status);
      console.log('   Model:', analysis.model_used);
      console.log('\n📝 Executive Summary:');
      console.log(analysis.executive_summary);

      // Parse and display arguments_for (benefits)
      if (analysis.arguments_for) {
        try {
          const argsFor = JSON.parse(analysis.arguments_for);
          console.log('\n✅ Potential Benefits (arguments_for):');
          argsFor.forEach((arg: any, i: number) => {
            console.log(`\n   ${i + 1}. ${arg.point}`);
            console.log(`      Evidence: ${arg.evidence}`);
          });
        } catch (e) {
          console.log('\n   ⚠️  Could not parse arguments_for JSON');
        }
      }

      // Parse and display arguments_against (concerns)
      if (analysis.arguments_against) {
        try {
          const argsAgainst = JSON.parse(analysis.arguments_against);
          console.log('\n⚠️  Potential Concerns (arguments_against):');
          argsAgainst.forEach((arg: any, i: number) => {
            console.log(`\n   ${i + 1}. ${arg.point}`);
            console.log(`      Evidence: ${arg.evidence}`);
          });
        } catch (e) {
          console.log('\n   ⚠️  Could not parse arguments_against JSON');
        }
      }

      // Parse and display stakeholder_impact
      if (analysis.stakeholder_impact) {
        try {
          const impact = JSON.parse(analysis.stakeholder_impact);
          console.log('\n🎯 Stakeholder Impact:');

          if (impact.winners && impact.winners.length > 0) {
            console.log('\n   Winners (who benefits):');
            impact.winners.forEach((winner: string) => {
              console.log(`   • ${winner}`);
            });
          }

          if (impact.losers && impact.losers.length > 0) {
            console.log('\n   Losers (who is disadvantaged):');
            impact.losers.forEach((loser: string) => {
              console.log(`   • ${loser}`);
            });
          }

          if (impact.affected_groups && impact.affected_groups.length > 0) {
            console.log('\n   Other Affected Groups:');
            impact.affected_groups.forEach((group: string) => {
              console.log(`   • ${group}`);
            });
          }
        } catch (e) {
          console.log('\n   ⚠️  Could not parse stakeholder_impact JSON');
        }
      }

      console.log('\n⏰ Timestamps:');
      console.log('   Started:', analysis.started_at);
      console.log('   Completed:', analysis.completed_at);
      console.log('   Analyzed:', new Date(analysis.analyzed_at * 1000).toISOString());

    } else {
      console.log('❌ No analysis found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

viewBillAnalysis().then(() => {
  console.log('\n✅ Complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
