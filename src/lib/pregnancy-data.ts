// Données informatives semaine par semaine (FR), sobres et bienveillantes.
// NON médical / non prescriptif : comparaison de taille, développement, conseil.
// Couvre les semaines 4 à 40. Pour une semaine < 4, on retombe sur la semaine 4 ;
// au-delà de 40, sur la 40 (voir weekInfo()).

export type WeekInfo = {
  week: number;
  fruit: string; // comparaison de taille
  development: string; // ce qui se passe pour bébé (1-2 phrases)
  tip: string; // conseil bien-être / maman
};

export const PREGNANCY_WEEKS: WeekInfo[] = [
  {
    week: 4,
    fruit: "une graine de pavot",
    development: "L'embryon vient de s'implanter et les premières structures se mettent en place. Le tube neural, qui formera le cerveau et la colonne, commence à se dessiner.",
    tip: "Une alimentation variée et de l'hydratation aident ton corps à s'adapter à ce grand début.",
  },
  {
    week: 5,
    fruit: "une graine de sésame",
    development: "Le cœur minuscule commence à se former et battra bientôt. Les bases du système nerveux poursuivent leur développement.",
    tip: "Écoute ta fatigue : les premières semaines demandent beaucoup d'énergie à ton corps.",
  },
  {
    week: 6,
    fruit: "un grain de lentille",
    development: "Le petit cœur bat désormais à un rythme rapide. Les ébauches du visage et des bras apparaissent doucement.",
    tip: "De petits repas fréquents peuvent aider si les nausées matinales se font sentir.",
  },
  {
    week: 7,
    fruit: "une myrtille",
    development: "La tête grandit vite tandis que le cerveau se développe. Les mains et les pieds commencent à se former en petites palettes.",
    tip: "Repose-toi dès que possible : la somnolence est très fréquente à ce stade.",
  },
  {
    week: 8,
    fruit: "une framboise",
    development: "Bébé bouge déjà, même si tu ne le sens pas encore. Les doigts et les orteils se dessinent peu à peu.",
    tip: "Une marche douce et de l'air frais peuvent atténuer les nausées et le stress.",
  },
  {
    week: 9,
    fruit: "une cerise",
    development: "Les traits du visage s'affinent et les paupières se forment. Les principaux organes continuent de se mettre en place.",
    tip: "Pense à des en-cas simples (fruits, biscuits secs) à portée de main pour les petites faims.",
  },
  {
    week: 10,
    fruit: "une fraise",
    development: "L'embryon devient officiellement un fœtus. Les petites articulations se plient et les ongles commencent à pousser.",
    tip: "Des vêtements confortables et amples accompagnent en douceur les premiers changements.",
  },
  {
    week: 11,
    fruit: "un citron vert",
    development: "Bébé bouge de plus en plus et peut s'étirer. Sa tête représente encore près de la moitié de sa longueur.",
    tip: "Bois régulièrement de l'eau tout au long de la journée pour rester bien hydratée.",
  },
  {
    week: 12,
    fruit: "un citron",
    development: "Les réflexes apparaissent et bébé peut ouvrir et fermer les doigts. La plupart des organes essentiels sont en place.",
    tip: "La fin du premier trimestre approche : l'énergie revient souvent peu à peu.",
  },
  {
    week: 13,
    fruit: "une pêche",
    development: "Les empreintes digitales se forment et les cordes vocales se mettent en place. Bébé avale et produit déjà du liquide.",
    tip: "C'est un bon moment pour des activités douces qui te détendent (étirements, respiration).",
  },
  {
    week: 14,
    fruit: "un citron mûr",
    development: "Bébé fait des mimiques et peut froncer les sourcils. Un fin duvet commence à recouvrir sa peau.",
    tip: "Bienvenue au deuxième trimestre, souvent le plus confortable : profite-en pour bouger un peu.",
  },
  {
    week: 15,
    fruit: "une pomme",
    development: "Bébé perçoit la lumière à travers la paroi et bouge beaucoup. Ses jambes s'allongent et dépassent désormais les bras.",
    tip: "Une bonne posture et des pauses régulières soulagent le bas du dos.",
  },
  {
    week: 16,
    fruit: "un avocat",
    development: "Les muscles du visage se développent et de petites expressions apparaissent. Tu pourrais bientôt sentir les premiers mouvements.",
    tip: "Reste à l'écoute de ton corps : les premiers « petits coups » sont parfois discrets.",
  },
  {
    week: 17,
    fruit: "une poire",
    development: "Bébé commence à stocker un peu de graisse et son squelette se solidifie. Il s'entraîne à téter et à avaler.",
    tip: "Des chaussures confortables aident à mesure que le centre de gravité change.",
  },
  {
    week: 18,
    fruit: "un poivron",
    development: "L'ouïe se développe : bébé commence à percevoir des sons étouffés. Il bouge, s'étire et change souvent de position.",
    tip: "Parle ou chante doucement : bébé s'habitue peu à peu au son de ta voix.",
  },
  {
    week: 19,
    fruit: "une mangue",
    development: "Un enduit protecteur recouvre la peau de bébé. Ses sens s'affinent de jour en jour.",
    tip: "Dormir sur le côté devient souvent plus confortable, avec un coussin de soutien si besoin.",
  },
  {
    week: 20,
    fruit: "une banane",
    development: "Tu es à mi-parcours ! Bébé bouge activement et alterne phases d'éveil et de sommeil.",
    tip: "Note les moments où tu sens bouger bébé : ça crée un joli lien au quotidien.",
  },
  {
    week: 21,
    fruit: "une carotte",
    development: "Les mouvements deviennent plus francs et coordonnés. Le système digestif s'entraîne en avalant du liquide.",
    tip: "Des collations équilibrées aident à garder de l'énergie tout au long de la journée.",
  },
  {
    week: 22,
    fruit: "une courgette",
    development: "Les traits du visage sont bien dessinés et les sourcils apparaissent. Bébé réagit de plus en plus aux sons.",
    tip: "Prends des moments calmes pour te reposer et savourer cette étape.",
  },
  {
    week: 23,
    fruit: "une grosse mangue",
    development: "La peau, encore fine, devient progressivement moins translucide. Bébé perçoit mieux les bruits venus de l'extérieur.",
    tip: "Hydrate ta peau si tu ressens des tiraillements au niveau du ventre.",
  },
  {
    week: 24,
    fruit: "un épi de maïs",
    development: "Les poumons se préparent doucement en développant de minuscules ramifications. Bébé a désormais un rythme de sommeil plus régulier.",
    tip: "Des pauses jambes surélevées soulagent si tu sens tes pieds gonfler en fin de journée.",
  },
  {
    week: 25,
    fruit: "un chou-fleur",
    development: "Bébé prend de la rondeur et sa peau se lisse. Il réagit aux sons familiers et peut sursauter à un bruit fort.",
    tip: "Continue à bouger en douceur : la marche reste une alliée précieuse.",
  },
  {
    week: 26,
    fruit: "une laitue",
    development: "Les yeux commencent à s'ouvrir et bébé perçoit la lumière. Ses mouvements respiratoires s'entraînent régulièrement.",
    tip: "Des exercices de respiration calme peuvent t'aider à te détendre le soir.",
  },
  {
    week: 27,
    fruit: "un chou-rave",
    development: "Bébé a le hoquet parfois, que tu peux sentir comme de petits soubresauts. Son cerveau est très actif.",
    tip: "Fin du deuxième trimestre : pense à des moments de repos pour recharger les batteries.",
  },
  {
    week: 28,
    fruit: "une aubergine",
    development: "Bébé ouvre et ferme les yeux et perçoit mieux la lumière. Il prend du poids régulièrement.",
    tip: "Bienvenue au troisième trimestre : écoute davantage les signaux de fatigue de ton corps.",
  },
  {
    week: 29,
    fruit: "une courge musquée",
    development: "Les muscles et les poumons continuent de mûrir. Les coups de pied se font plus vigoureux.",
    tip: "Des repas riches en fer et en calcium soutiennent cette phase de croissance.",
  },
  {
    week: 30,
    fruit: "un gros concombre",
    development: "Le cerveau se plisse pour gagner en surface. Bébé régule un peu mieux sa température.",
    tip: "Un bon soutien lombaire en position assise soulage le dos qui travaille plus.",
  },
  {
    week: 31,
    fruit: "une noix de coco",
    development: "Bébé bouge beaucoup dans un espace désormais plus restreint. Tous ses sens sont en éveil.",
    tip: "Repère des positions de repos confortables pour mieux dormir la nuit.",
  },
  {
    week: 32,
    fruit: "un ananas",
    development: "Les ongles des doigts et des orteils sont formés. Bébé s'installe souvent peu à peu tête vers le bas.",
    tip: "Des pauses régulières dans la journée aident à gérer la fatigue qui revient.",
  },
  {
    week: 33,
    fruit: "un melon",
    development: "Les os se renforcent tout en restant souples pour la naissance. Bébé distingue mieux le jour de la nuit grâce à la lumière.",
    tip: "Hydrate-toi bien et fractionne tes repas si tu te sens vite rassasiée.",
  },
  {
    week: 34,
    fruit: "un melon cantaloup",
    development: "Les poumons poursuivent leur maturation. Bébé a déjà un joli duvet de cheveux pour certains.",
    tip: "Prépare-toi en douceur : un sac et des affaires prêtes apportent de la sérénité.",
  },
  {
    week: 35,
    fruit: "une grosse mangue",
    development: "Bébé prend surtout du poids désormais. Il se met progressivement en position pour la naissance.",
    tip: "Écoute ton rythme et n'hésite pas à déléguer les tâches fatigantes.",
  },
  {
    week: 36,
    fruit: "une salade romaine",
    development: "Bébé descend doucement vers le bassin. Sa peau est plus lisse et bien rosée.",
    tip: "Des moments de calme et de respiration t'aident à aborder la fin sereinement.",
  },
  {
    week: 37,
    fruit: "une botte de blettes",
    development: "Bébé est considéré comme presque à terme. Il s'entraîne à respirer, téter et agripper.",
    tip: "Repose-toi un maximum : chaque moment de sommeil est précieux maintenant.",
  },
  {
    week: 38,
    fruit: "un poireau",
    development: "Les organes de bébé sont prêts à fonctionner. Il continue d'affiner ses réflexes.",
    tip: "Garde tes documents et contacts utiles à portée de main, au cas où.",
  },
  {
    week: 39,
    fruit: "une petite pastèque",
    development: "Bébé est à terme et bien installé. Il accumule les dernières réserves d'énergie.",
    tip: "Alterne repos et petites marches selon ton confort et ton envie.",
  },
  {
    week: 40,
    fruit: "une pastèque",
    development: "C'est la semaine prévue pour la rencontre ! Bébé est prêt à découvrir le monde.",
    tip: "Reste à l'écoute de ton corps et entoure-toi de personnes de confiance.",
  },
];

// Retourne les infos de la semaine demandée, bornée à [4, 40].
export function weekInfo(week: number): WeekInfo {
  const w = Math.max(4, Math.min(40, Math.round(week)));
  return PREGNANCY_WEEKS.find((x) => x.week === w) ?? PREGNANCY_WEEKS[0];
}
