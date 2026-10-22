export const MODEL_VERSION = "1.0.0";
export const BASELINE = Object.freeze({
  population: 840000, populationGrowth: 1.4, roadCapacity: 62, transitInvestment: 48,
  transitCapacity: 55, congestionPricing: 15, renewableCapacity: 42, energyEfficiency: 52,
  industrialActivity: 58, housingSupply: 61, affordableHousingShare: 32, greenCoverage: 28,
  waterInfrastructureInvestment: 44, conservationEfficiency: 38, carbonPolicy: 35,
  infrastructureMaintenance: 48, cyclingInfrastructure: 35, serviceFrequency: 50,
  electrification: 42, commercialDevelopment: 55, wasteRecovery: 40, resilienceInvestment: 35
});
const clamp = (n, lo=0, hi=100) => Math.min(hi, Math.max(lo, n));
const round = (n, d=1) => Number(n.toFixed(d));
export function simulate(raw) {
  const p = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k, k === "population" ? clamp(Number(v),10000,5000000) : clamp(Number(v))]));
  const pop = p.population;
  const demand = pop / 840000 * (0.75 + p.populationGrowth * .18);
  const transitShare = clamp(18 + p.transitInvestment*.27 + p.transitCapacity*.14 + p.serviceFrequency*.12 + p.cyclingInfrastructure*.08 - p.congestionPricing*.025, 8, 72);
  const roadDemand = demand * (76 - transitShare*.42 + p.industrialActivity*.08);
  const congestion = clamp(roadDemand / (0.65 + p.roadCapacity/100) - p.congestionPricing*.10 - p.cyclingInfrastructure*.035, 8, 98);
  const energyDemand = pop/1000 * (0.68 + p.industrialActivity*.008 + p.electrification*.003 - p.energyEfficiency*.0035);
  const renewableGeneration = energyDemand * (p.renewableCapacity/100) * (0.72 + p.energyEfficiency*.002);
  const renewableShare = clamp(renewableGeneration / Math.max(energyDemand, .1) * 100, 0, 95);
  const emissions = Math.max(5, energyDemand * (1.18 - renewableShare*.0085) * (1 - p.carbonPolicy*.0022) * (1 - p.energyEfficiency*.001));
  const waterDemand = pop/1000 * (0.74 + p.industrialActivity*.003 - p.conservationEfficiency*.003);
  const waterSupply = pop/1000 * (0.88 + p.waterInfrastructureInvestment*.003 + p.conservationEfficiency*.002 - p.populationGrowth*.012);
  const waterSecurity = clamp(50 + (waterSupply-waterDemand)*35 + p.waterInfrastructureInvestment*.16 + p.conservationEfficiency*.12, 5, 99);
  const housingDemand = pop/840000 * (62 + p.populationGrowth*5);
  const affordability = clamp(45 + (p.housingSupply-housingDemand)*.42 + p.affordableHousingShare*.28 - p.commercialDevelopment*.08, 5, 95);
  const economic = clamp(58 + p.industrialActivity*.22 + p.commercialDevelopment*.18 + p.transitInvestment*.08 - congestion*.09 - p.carbonPolicy*.025, 15, 98);
  const infraStress = clamp(30 + demand*18 + congestion*.18 + energyDemand*.015 - p.infrastructureMaintenance*.25 - p.waterInfrastructureInvestment*.12 - p.resilienceInvestment*.15, 5, 98);
  const resilience = clamp(36 + p.resilienceInvestment*.25 + p.greenCoverage*.16 + p.infrastructureMaintenance*.14 + p.waterInfrastructureInvestment*.1 - infraStress*.12, 10, 95);
  const policyCost = round(p.transitInvestment*1.8 + p.renewableCapacity*2.1 + p.waterInfrastructureInvestment*1.2 + p.housingSupply*1.4 + p.greenCoverage*1.1 + p.resilienceInvestment*1.6 + p.roadCapacity*.7, 0);
  return {
    population: Math.round(pop), congestionIndex: round(congestion), averageTravelTime: round(18 + congestion*.31,1),
    transitModeShare: round(transitShare), energyDemand: round(energyDemand,0), renewableShare: round(renewableShare),
    emissionsIndex: round(emissions,1), waterDemand: round(waterDemand,0), waterSupply: round(waterSupply,0),
    waterSecurity: round(waterSecurity), housingAffordability: round(affordability), economicActivityIndex: round(economic),
    infrastructureStress: round(infraStress), resilienceIndex: round(resilience), estimatedPolicyCost: policyCost,
    roadUtilization: round(clamp(roadDemand/(p.roadCapacity+35)*100)), transitUtilization: round(clamp(transitShare/(p.transitCapacity/1.5+10)*100)),
    housingSupply: p.housingSupply, greenCoverage: p.greenCoverage, employmentIndex: round(clamp(economic*.92 + p.industrialActivity*.08)),
    gridEmissionsIntensity: round(emissions/Math.max(energyDemand,.1),3)
  };
}
export function compareMetrics(metrics, baseline) {
  const keys = ["congestionIndex","transitModeShare","renewableShare","emissionsIndex","waterSecurity","housingAffordability","economicActivityIndex","infrastructureStress","resilienceIndex","estimatedPolicyCost"];
  return keys.map(key => ({key, value: metrics[key], baseline: baseline[key], delta: round(metrics[key]-baseline[key],1)}));
}
export function buildScenarios() {
  const config = [
    ["Business as Usual","Current-policy reference",{}],
    ["Green Mobility Transition","Transit, cycling and clean power",{transitInvestment:78,transitCapacity:76,serviceFrequency:78,cyclingInfrastructure:74,renewableCapacity:72,greenCoverage:42,congestionPricing:38}],
    ["High-Growth Expansion","Development-led growth with infrastructure pressure",{populationGrowth:2.5,industrialActivity:78,commercialDevelopment:78,housingSupply:72,roadCapacity:75,renewableCapacity:45}],
    ["Climate Resilience Strategy","Water security, green coverage and resilience",{resilienceInvestment:82,greenCoverage:68,waterInfrastructureInvestment:78,conservationEfficiency:76,renewableCapacity:72,infrastructureMaintenance:75,carbonPolicy:68}]
  ];
  return config.map(([name,description,overrides],i) => {
    const parameters = {...BASELINE,...overrides};
    return {id:"preset-"+i,name,description,parameters,metrics:simulate(parameters),modelVersion:MODEL_VERSION,createdAt:"Built-in"};
  });
}
export function answerQuestion(question, current, scenarios) {
  const q = question.toLowerCase();
  if (q.includes("emission") || q.includes("carbon")) {
    const best = [...scenarios].sort((a,b)=>a.metrics.emissionsIndex-b.metrics.emissionsIndex)[0];
    return `The lowest modeled emissions among saved scenarios are in “${best.name}” at ${best.metrics.emissionsIndex.toFixed(1)} index units. The current scenario is ${current.emissionsIndex.toFixed(1)}. This is a deterministic comparison of synthetic inputs, not a real-world emissions forecast.`;
  }
  if (q.includes("congestion") || q.includes("traffic")) return `The current congestion index is ${current.congestionIndex}/100 and modeled travel time is ${current.averageTravelTime} minutes. Transit mode share is ${current.transitModeShare}%. Try increasing transit investment, service frequency or cycling infrastructure; road expansion can help capacity but may be partly offset by induced demand in a more detailed model.`;
  if (q.includes("housing") || q.includes("afford")) return `The modeled housing affordability index is ${current.housingAffordability}/100. Housing supply and affordable-housing allocation improve the index in this model, while strong commercial development and population growth can increase pressure. These are illustrative relationships, not market estimates.`;
  if (q.includes("water")) return `Modeled water demand is ${current.waterDemand} units and effective supply is ${current.waterSupply} units. The water security index is ${current.waterSecurity}/100. Increasing conservation efficiency or water infrastructure investment should improve this balance under the current assumptions.`;
  if (q.includes("compare") || q.includes("scenario")) {
    const ranked = [...scenarios].sort((a,b)=>b.metrics.resilienceIndex-a.metrics.resilienceIndex);
    return `Among saved scenarios, “${ranked[0].name}” has the highest modeled resilience (${ranked[0].metrics.resilienceIndex}/100). “${[...scenarios].sort((a,b)=>a.metrics.economicActivityIndex-b.metrics.economicActivityIndex).at(-1).name}” has the highest economic activity index. No scenario is universally best; results depend on the objective and assumptions.`;
  }
  if (q.includes("recommend") || q.includes("what should") || q.includes("improve")) return `Based on the current synthetic results, test three interventions: (1) increase transit investment and service frequency to improve modeled mobility; (2) increase renewable capacity and energy efficiency to reduce emissions intensity; (3) raise water infrastructure investment and conservation efficiency if water security is a priority. Run each change separately and compare costs and trade-offs before combining them.`;
  if (q.includes("energy") || q.includes("renewable")) return `Estimated demand is ${current.energyDemand} illustrative energy units and the modeled renewable share is ${current.renewableShare}%. Grid emissions intensity is ${current.gridEmissionsIntensity}. Increasing renewable capacity and efficiency reduces modeled emissions, while industrial activity and electrification can raise demand.`;
  return `I can explain the current modeled metrics: congestion ${current.congestionIndex}/100, transit share ${current.transitModeShare}%, renewable share ${current.renewableShare}%, emissions index ${current.emissionsIndex}, water security ${current.waterSecurity}/100, affordability ${current.housingAffordability}/100 and resilience ${current.resilienceIndex}/100. Ask about traffic, emissions, energy, water, housing, recommendations or scenario comparison. Results are synthetic and assumption-dependent.`;
}
