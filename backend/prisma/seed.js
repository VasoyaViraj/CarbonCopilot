import prisma from '../src/db/db.js';

const circularAlternatives = [
  {
    category: 'material',
    current_option: 'virgin_aluminum',
    alternative_option: 'recycled_aluminum',
    description: 'Switching from virgin to recycled aluminum reduces energy consumption heavily.',
    reduction_percent: 15.0,
    cost_level: 'Medium',
    implementation_difficulty: 'Medium',
    estimated_payback_years: 2.5,
    circularity_score: 85.0
  },
  {
    category: 'energy efficiency',
    current_option: 'standard_boiler',
    alternative_option: 'waste_heat_recovery_boiler',
    description: 'Capture waste heat from the furnace to pre-heat boiler water.',
    reduction_percent: 12.0,
    cost_level: 'High',
    implementation_difficulty: 'High',
    estimated_payback_years: 2.4,
    circularity_score: 91.0
  },
  {
    category: 'fuel substitution',
    current_option: 'natural_gas',
    alternative_option: 'biogas',
    description: 'Transition from natural gas to locally sourced biogas.',
    reduction_percent: 40.0,
    cost_level: 'Medium',
    implementation_difficulty: 'Medium',
    estimated_payback_years: 3.0,
    circularity_score: 95.0
  },
  {
    category: 'waste recovery',
    current_option: 'landfill_metal_scrap',
    alternative_option: 'internal_metal_recycling',
    description: 'Collect and remelt metal scrap within the same facility instead of landfilling.',
    reduction_percent: 8.0,
    cost_level: 'Low',
    implementation_difficulty: 'Low',
    estimated_payback_years: 1.0,
    circularity_score: 99.0
  },
  {
    category: 'process optimization',
    current_option: 'manual_furnace_control',
    alternative_option: 'ai_optimized_furnace_control',
    description: 'Use AI to optimize the air-fuel ratio in the furnace in real-time.',
    reduction_percent: 5.0,
    cost_level: 'Low',
    implementation_difficulty: 'Low',
    estimated_payback_years: 0.5,
    circularity_score: 50.0
  }
];

async function main() {
  console.log('Start seeding circular alternatives...');

  for (const alt of circularAlternatives) {
    const existingAlt = await prisma.circularAlternative.findUnique({
      where: {
        current_option_alternative_option: {
          current_option: alt.current_option,
          alternative_option: alt.alternative_option
        }
      }
    });

    if (!existingAlt) {
      await prisma.circularAlternative.create({
        data: alt
      });
      console.log(`Created alternative: ${alt.alternative_option}`);
    } else {
      console.log(`Alternative ${alt.alternative_option} already exists.`);
    }
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
