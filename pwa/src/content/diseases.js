/**
 * Reference text for the Disease guide screen: the three diseases the model
 * screens for, plus what healthy droppings look like.
 */
export const DISEASES = [
  {
    id: 'ncd',
    name: 'Newcastle Disease (NCD)',
    definition:
      'A highly contagious, often fatal viral disease caused by avian paramyxovirus type 1. It is one of the most economically devastating poultry diseases worldwide and is notifiable by law in many countries because of its rapid spread and severity.',
    signs:
      'Rapid spread, gasping, rattling, loss of appetite, coughing, huddling, paralysis of the legs, twisted neck (stargazing), walking backward, drop in egg production, soft or misshapen eggs, and death. Difficulty breathing, paralysis and twisting of the neck are also commonly noted.',
    droppings:
      'Greenish, watery diarrhoea is the key dropping-related sign. It is consistently reported alongside the respiratory and neurological signs.',
    transmission:
      'Spreads to chickens by direct contact with droppings or discharges from infected birds.',
    differentiator:
      'NCD is the only one of the three diseases with prominent neurological and respiratory signs (twisted neck, leg paralysis, gasping) alongside the dropping changes. The other two are mainly gastrointestinal.',
  },
  {
    id: 'cocci',
    name: 'Coccidiosis',
    definition:
      'A parasitic disease caused by protozoa of the genus Eimeria, which infect the intestinal tract. It is the single most common cause of death in young birds and a serious disease of young stock up to 10 weeks of age. Outbreaks occur in warm, humid weather and on damp litter.',
    signs:
      'Bloody diarrhoea, soiling of the vent, weight loss, paleness, ruffled feathers, huddling and depression. Diarrhoea, lethargy, anaemia and reduced appetite are also common, with bloody droppings and a swollen abdomen in more advanced cases.',
    droppings:
      'Bloody droppings in the litter, together with stunted growth. Caecal coccidiosis in particular produces bloody droppings.',
    transmission:
      'Spreads through the droppings of infected chickens. Birds that are overcrowded, stressed or kept in poor sanitation are at higher risk.',
    differentiator:
      'Coccidiosis is the disease most directly tied to visible blood in the droppings. That is its signature visual marker, and it makes coccidiosis the easiest of the three to tell apart by the droppings alone.',
  },
  {
    id: 'salmonella',
    name: 'Salmonella (Fowl Typhoid / Pullorum)',
    definition:
      'A bacterial disease. It has a few forms that present slightly differently:',
    forms: [
      { name: 'Fowl Typhoid', text: 'caused by Salmonella gallinarum.' },
      {
        name: 'Pullorum Disease',
        text: 'caused by Salmonella pullorum. It is highly contagious and infects the ovary of the hen.',
      },
    ],
    signs:
      'Fowl Typhoid: loss of appetite, ruffled feathers, drooping wings, sleepiness and greenish diarrhoea. Pullorum (more common in young chicks): drowsiness, not eating, gasping, whitish diarrhoea, soiling of the vent and sudden death. More broadly, diarrhoea (which may contain blood and mucus), dehydration, weakness, paralysis, and respiratory signs such as sneezing and coughing are reported.',
    droppings:
      'Whitish or greenish diarrhoea, unlike the blood-red droppings of coccidiosis. (Whitish patches above the liver are seen only when a bird is opened up after death.)',
    transmission:
      'Often passed through the egg (Pullorum spreads during incubation or shortly after hatching), or through contact with contaminated droppings.',
    differentiator:
      'Salmonella droppings tend toward white, greenish or chalky colours rather than the bright red of coccidiosis, and it lacks the neurological signs of NCD.',
  },
];

export const HEALTHY = {
  name: 'Healthy droppings',
  text: [
    'Normal droppings are light to dark brown and firm or well formed. The white cap on top (urates) is a normal part of a dropping, not a sign of disease.',
    'An occasional clear or watery dropping can also be normal, as long as some faecal matter is still present. Healthy droppings vary; they do not all look the same.',
  ],
};

export const COMPARISON = {
  columns: ['Condition', 'Cause', 'Dropping colour and texture', 'Other key signs', 'Age most affected'],
  rows: [
    ['Healthy', '—', 'Brown, firm, white urate cap', 'Normal activity and appetite', 'All ages'],
    [
      'Newcastle Disease',
      'Avian paramyxovirus (viral)',
      'Greenish, watery',
      'Twisted neck, leg paralysis, gasping, breathing difficulty',
      'All ages',
    ],
    [
      'Coccidiosis',
      'Eimeria protozoa (parasitic)',
      'Bloody or red-tinged',
      'Lethargy, pale comb, ruffled feathers, weight loss',
      'Young birds, up to 8–10 weeks',
    ],
    [
      'Salmonella',
      'Salmonella bacteria',
      'Whitish or greenish, chalky diarrhoea',
      'Drowsiness, loss of appetite, sudden death (chicks)',
      'Especially young chicks',
    ],
  ],
};
