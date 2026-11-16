// Langue du jeu : français (texte d'origine) ou anglais (traduit ici).
// Choix : ?lang=en / ?lang=fr dans l'adresse, sinon choix retenu, sinon langue du navigateur.
// T(texte) traduit un texte français ; les dessins sur le canevas passent aussi par T (fillText / measureText).
"use strict";
(() => {
  const CLE = "dipduck-langue";
  let lang = null;
  try { const q = new URLSearchParams(location.search).get("lang"); if (q === "fr" || q === "en") { lang = q; localStorage.setItem(CLE, q); } } catch (e) {}
  if (!lang) { try { lang = localStorage.getItem(CLE); } catch (e) {} }
  if (lang !== "fr" && lang !== "en") lang = /^fr\b/i.test(navigator.language || "") ? "fr" : "en";
  window.LANG = lang;
  window.changerLangue = (l) => { try { localStorage.setItem(CLE, l); } catch (e) {} const u = new URL(location.href); u.searchParams.delete("lang"); location.href = u.href; };

  // ---- textes exacts ----
  const EN = {
    // lieux
    "Village de l'Étang": "Pond Village", "Hameau du Moulin": "Mill Hamlet", "Port du Lac": "Lake Harbor",
    "Campement des Bois": "Woods Camp", "Ruines du Calme": "Ruins of Calm", "Val de l'Étang": "Pond Vale",
    "FORÊT PROFONDE": "DEEP FOREST", "VAL DE L'ÉTANG": "POND VALE", "MONTS DU VENT": "WIND MOUNTAINS", "CÔTE AUX PHARES": "LIGHTHOUSE COAST",
    "Forêt Profonde": "Deep Forest", "Clairière des Lucioles": "Firefly Glade", "Temple Moussu": "Mossy Temple",
    "Monts du Vent": "Wind Mountains", "Refuge des Cimes": "Summit Lodge", "Tour du Vent": "Wind Tower", "Lac gelé": "Frozen Lake",
    "Côte aux Phares": "Lighthouse Coast", "Phare de la Bougie Noire": "Black Candle Lighthouse", "Port-Plume": "Featherport",
    "Grotte des Échos": "Echo Cave", "Île": "Island", "Îlot": "Islet",
    "→ Forêt Profonde": "→ Deep Forest", "→ Val de l'Étang": "→ Pond Vale", "→ Monts du Vent": "→ Wind Mountains", "→ Côte aux Phares": "→ Lighthouse Coast",
    "Forêt": "Forest", "Marais": "Marsh", "Montagnes": "Mountains", "Champs": "Fields", "Rivière": "River", "Route": "Road", "Prairie": "Meadow",
    "Maison": "House", "Boulangerie": "Bakery", "Chapelle": "Chapel", "Grange": "Barn", "École": "School", "Taverne du Canard Calme": "The Calm Duck Tavern",
    // panneaux dessinés
    "ÉTANG": "POND", "MARCHÉ": "MARKET", "ÉPICERIE": "GROCERY", "ÉCOLE": "SCHOOL", "GARE DE L'ÉTANG": "POND STATION", "TÉL": "TEL",
    "SORTIE": "EXIT", "FARINE": "FLOUR", "POISSON": "FISH", "SAC": "BAG", "CALME": "CALM",
    // personnages
    "Grand-père Grenouille": "Grandpa Frog", "Madame Crapaude": "Madam Toad", "Le Castor": "The Beaver", "Goéland": "Gull",
    "Ti-Grenouille": "Li'l Frog", "Le Tavernier": "The Innkeeper", "Le Boulanger": "The Baker", "Le Sonneur": "The Bell-Ringer",
    "La Maîtresse": "The Teacher", "La Chouette Sage": "The Wise Owl", "Le Renard Marchand": "The Merchant Fox", "Mère Écureuil": "Mother Squirrel",
    "Le Guide des Cimes": "The Summit Guide", "Le Bûcheron": "The Woodcutter", "Mamie Chèvre": "Granny Goat",
    "La Capitaine Mouette": "Captain Seagull", "Le Vieux Pêcheur": "The Old Fisherman",
    "Le Golem des Échos": "The Echo Golem", "Le Grand Feu Follet": "The Great Will-o'-Wisp", "Le Roi Tourbillon": "The Whirlwind King", "La Bougie Noire": "The Black Candle",
    // objets, saisons
    "Grappin": "Grappling Hook", "Bottes du Vent": "Wind Boots", "été": "summer", "automne": "autumn", "hiver": "winter", "nuit": "night",
    // villageois
    "Bienvenue à la Taverne du Canard Calme !": "Welcome to the Calm Duck Tavern!",
    "On raconte qu'une grotte s'ouvre au pied des montagnes, au nord. Les anciens l'appellent la Grotte des Échos.": "They say a cave opens at the foot of the mountains, to the north. The elders call it the Echo Cave.",
    "Il paraît qu'une lanterne magique y dort dans un coffre… gardée par des énigmes.": "Rumor has it a magic lantern sleeps there in a chest… guarded by puzzles.",
    "Bienvenue à la boulangerie, petit canard !": "Welcome to the bakery, little duck!",
    "Ma tarte aux baies te remet tous tes cœurs : 3 pièces.": "My berry pie restores all your hearts: 3 coins.",
    "Chut… ici, on vient chercher le calme.": "Shh… people come here looking for calm.",
    "Ces cierges blancs brûlent sans jamais paniquer. Les bougies rouges, elles, ont oublié comment.": "These white candles burn without ever panicking. The red candles have forgotten how.",
    "Une vieille légende dit qu'une Bougie Noire, cachée quelque part, les rend toutes rouges…": "An old legend says a Black Candle, hidden somewhere, turns them all red…",
    "Bonjour ! Aujourd'hui, la leçon du jour :": "Hello! Here is today's lesson:",
    "Quand tout s'agite, on respire, on compte jusqu'à trois… et on réfléchit avant d'agir.": "When everything gets hectic, breathe, count to three… and think before you act.",
    "C'est comme ça qu'on calme une bougie rouge. Et beaucoup d'autres choses !": "That's how you calm a red candle. And many other things!",
    // donjons, coffres, portes
    "La Grotte des Échos.": "The Echo Cave.",
    "La Grotte des Échos… il fait sombre. (Bloc coincé ? Ressors et reviens.)": "The Echo Cave… it's dark. (Block stuck? Step out and come back.)",
    "Le coffre de l'îlot : +1 cœur et +10 pièces !": "The islet chest: +1 heart and +10 coins!",
    "Le coffre est vide.": "The chest is empty.",
    "Les BOTTES DU VENT ! Marche dans une direction et appuie sur X pour bondir. (C : changer d'objet)": "The WIND BOOTS! Walk in a direction and press X to leap. (C: switch item)",
    "La PLUME DU VENT ! +1 cœur et +20 pièces. ✨": "The WIND FEATHER! +1 heart and +20 coins. ✨",
    "Le coffre de l'île : +1 cœur et +10 pièces !": "The island chest: +1 heart and +10 coins!",
    "Le GRAPPIN ! Tourne-toi vers un poteau et appuie sur X (ou OBJET).": "The GRAPPLING HOOK! Face a post and press X (or ITEM).",
    "La PLUME DE LA FORÊT ! +1 cœur et +20 pièces. ✨": "The FOREST FEATHER! +1 heart and +20 coins. ✨",
    "Coffre : +5 pièces !": "Chest: +5 coins!",
    "La Lanterne des Échos ! +1 cœur et +20 pièces. ✨": "The Echo Lantern! +1 heart and +20 coins. ✨",
    "La porte de la tour s'ouvre !": "The tower door opens!",
    "Fermée à clé. La clé est de l'autre côté d'un gouffre… il faudrait bondir.": "Locked. The key is across a chasm… you'd need to leap.",
    "La porte du temple s'ouvre !": "The temple door opens!",
    "Fermée à clé. La clé est de l'autre côté d'un gouffre, à droite…": "Locked. The key is across a chasm, to the right…",
    "La clé tourne… la porte s'ouvre !": "The key turns… the door opens!",
    "Une porte fermée à clé. La clé doit être quelque part dans la grotte…": "A locked door. The key must be somewhere in the cave…",
    "Le bloc ne bouge pas de ce côté.": "The block won't move that way.",
    "Clac ! La grille s'est levée au fond de la grotte.": "Clack! The gate at the back of the cave has lifted.",
    "Espace : entrer dans la Tour du Vent": "Space: enter the Wind Tower",
    "Espace : entrer dans le Phare": "Space: enter the Lighthouse",
    "Espace : ouvrir le coffre": "Space: open the chest",
    "Espace : entrer dans le Temple Moussu": "Space: enter the Mossy Temple",
    "Espace : entrer dans la Grotte des Échos": "Space: enter the Echo Cave",
    // forêt
    "Psst, petit canard ! Je vends une Fiole de vie : +1 cœur pour toujours. 40 pièces, une seule fois.": "Psst, little duck! I sell a Vial of Life: +1 heart forever. 40 coins, one time only.",
    "Et ma tarte aux mûres te remet tous tes cœurs : 3 pièces.": "And my blackberry pie restores all your hearts: 3 coins.",
    "Les feux follets bleus ne sont pas méchants… juste paniqués. Un coup de bec les apaise.": "The blue wisps aren't mean… just panicked. A peck calms them down.",
    "Au nord, le Temple Moussu est plein de gouffres. Il paraît qu'on y trouve un grappin !": "To the north, the Mossy Temple is full of chasms. They say there's a grappling hook inside!",
    "La Forêt Profonde — la Clairière des Lucioles est droit devant.": "The Deep Forest — Firefly Glade is straight ahead.",
    "Retour au Val de l'Étang.": "Back to Pond Vale.",
    "Le Temple Moussu.": "The Mossy Temple.",
    "Le Temple Moussu… des gouffres partout. Il faudrait un grappin.": "The Mossy Temple… chasms everywhere. You'd need a grappling hook.",
    "Le grappin ne trouve aucun poteau dans cette direction.": "The hook finds no post in that direction.",
    // monts
    "Brrr ! Ici, le vent souffle par rafales. Attends qu'il se calme avant de traverser.": "Brrr! The wind blows in gusts up here. Wait for it to calm down before crossing.",
    "On dit que la Tour du Vent cache des bottes qui font bondir comme une bourrasque.": "They say the Wind Tower hides boots that make you leap like a gust.",
    "J'ai grimpé ces montagnes toute ma vie, petit.": "I've climbed these mountains all my life, little one.",
    "Sur le lac gelé, ça glisse… mais les plus belles fleurs, les edelweiss, poussent près des falaises.": "The frozen lake is slippery… but the prettiest flowers, edelweiss, grow near the cliffs.",
    "Les Monts du Vent — le Refuge des Cimes est à l'ouest. Gare aux rafales !": "The Wind Mountains — Summit Lodge is to the west. Watch out for gusts!",
    "La Tour du Vent.": "The Wind Tower.",
    "La Tour du Vent… un coffre doit cacher les Bottes du Vent.": "The Wind Tower… a chest must be hiding the Wind Boots.",
    "CRAC ! La glace vole en éclats.": "CRACK! The ice shatters.",
    "Plouf ! Trop court… élance-toi tout près du bord.": "Splash! Too short… take off right at the edge.",
    "Tu n'as qu'un objet pour l'instant.": "You only have one item for now.",
    "Tu n'as pas encore d'objet.": "You don't have any items yet.",
    "Tu n'as pas encore d'objet à utiliser.": "You don't have an item to use yet.",
    // boss
    "La Bougie Noire s'embrase ! Elle fonce maintenant… fais-la se cogner aux murs !": "The Black Candle flares up! Now it charges… make it crash into the walls!",
    "Trop dur ! Attends qu'il se cogne contre un mur.": "Too tough! Wait until it hits a wall.",
    "Sa flamme noire te repousse ! Attends qu'elle s'essouffle.": "Its black flame pushes you back! Wait until it runs out of breath.",
    "Le vent te repousse ! Fonce-lui dessus avec les Bottes du Vent (X).": "The wind pushes you back! Charge at it with the Wind Boots (X).",
    "BOUM ! Il est sonné : vite, un coup de bec !": "BOOM! It's stunned: quick, peck it!",
    "Elle s'essouffle : vite, un coup de bec !": "It's out of breath: quick, peck it!",
    // côte
    "Depuis que la Bougie Noire s'est installée dans le phare, il ne guide plus les bateaux.": "Since the Black Candle moved into the lighthouse, it no longer guides the boats.",
    "Les poissons ont peur, les marins aussi. Il faut rallumer la vraie lumière !": "The fish are scared, and so are the sailors. The true light must be relit!",
    "Grand-père Grenouille, c'est mon arrière-grand-oncle !": "Grandpa Frog is my great-great-uncle!",
    "Il dit que la Bougie Noire n'est pas méchante… qu'elle a juste avalé toute la peur de l'Étang.": "He says the Black Candle isn't evil… it just swallowed all the fear of the Pond.",
    "La Côte aux Phares — Port-Plume est tout près. Le phare est éteint…": "Lighthouse Coast — Featherport is close by. The lighthouse is dark…",
    "Le phare est calme.": "The lighthouse is calm.",
    "Le Phare… tout en haut, une flamme noire. Il faudra tous tes objets.": "The Lighthouse… a black flame at the very top. You'll need all your items.",
    "Clac ! La grille du phare se lève.": "Clack! The lighthouse gate lifts.",
    "La porte du sommet s'ouvre… une chaleur noire en sort.": "The top door opens… a dark heat pours out.",
    "Fermée à clé. La clé est derrière le gouffre, en bas à droite.": "Locked. The key is past the chasm, bottom right.",
    // quêtes
    "Parle à Grand-père Grenouille, au Village de l'Étang.": "Talk to Grandpa Frog in Pond Village.",
    "Retourne voir Grand-père Grenouille.": "Go back to Grandpa Frog.",
    "Ramène les nouvelles à Grand-père Grenouille.": "Bring the news back to Grandpa Frog.",
    "Va aux Ruines du Calme, au sud-est, et calme la Grande Bougie.": "Go to the Ruins of Calm, to the southeast, and calm the Great Candle.",
    "Ouvre le coffre des ruines.": "Open the chest in the ruins.",
    "Rapporte la Plume du Calme à Grand-père Grenouille.": "Bring the Feather of Calm to Grandpa Frog.",
    "L'Étang est calme… pour l'instant. Explore et collectionne !": "The Pond is calm… for now. Explore and collect!",
    "Va dans la Forêt Profonde (sentier au nord du Campement des Bois) et trouve la Chouette Sage.": "Go to the Deep Forest (path north of Woods Camp) and find the Wise Owl.",
    "Explore le Temple Moussu, au nord de la forêt, et trouve la Plume de la Forêt.": "Explore the Mossy Temple, north of the forest, and find the Forest Feather.",
    "Rapporte la Plume de la Forêt à la Chouette Sage.": "Bring the Forest Feather to the Wise Owl.",
    "Deux Plumes du Calme réunies ! La suite arrive bientôt… Explore et collectionne.": "Two Feathers of Calm gathered! More is coming soon… Explore and collect.",
    "Va dans les Monts du Vent (sentier à l'ouest du Hameau du Moulin) et trouve le Guide des Cimes.": "Go to the Wind Mountains (path west of Mill Hamlet) and find the Summit Guide.",
    "Monte à la Tour du Vent, au nord des Monts, et trouve la Plume du Vent.": "Climb the Wind Tower, north of the Mountains, and find the Wind Feather.",
    "Rapporte la Plume du Vent au Guide des Cimes.": "Bring the Wind Feather to the Summit Guide.",
    "Trois Plumes du Calme réunies ! La suite arrive bientôt… Explore et collectionne.": "Three Feathers of Calm gathered! More is coming soon… Explore and collect.",
    "Va sur la Côte aux Phares (route à l'est du Port du Lac) et parle à la Capitaine Mouette.": "Go to Lighthouse Coast (road east of Lake Harbor) and talk to Captain Seagull.",
    "Traverse le long pont jusqu'au Phare et affronte la Bougie Noire.": "Cross the long bridge to the Lighthouse and face the Black Candle.",
    "Rapporte la Plume de Lumière à la Capitaine Mouette.": "Bring the Feather of Light to Captain Seagull.",
    "Fin de l'Acte I — merci d'avoir joué ! Explore et collectionne tout.": "End of Act I — thanks for playing! Explore and collect everything.",
    // Grand-père Grenouille
    "Bienvenue au Village de l'Étang, petit !": "Welcome to Pond Village, little one!",
    "Les bougies rouges se sont réveillées : elles sèment la panique partout.": "The red candles have woken up: they're spreading panic everywhere.",
    "Calmes-en dix d'un bon coup de bec. Mais attention, ça brûle !": "Calm ten of them with a good peck. But careful, they burn!",
    "Continue ! Il en reste encore dans les champs et les prés.": "Keep going! There are still some in the fields and meadows.",
    "Bravo ! Les champs respirent.": "Well done! The fields can breathe again.",
    "Mais trois de nos canetons se sont perdus en fuyant les bougies.": "But three of our ducklings got lost running from the candles.",
    "Le Goéland du Port et le Castor du Hameau les ont peut-être vus. Retrouve-les !": "The Harbor Gull and the Hamlet Beaver may have seen them. Find them!",
    "Les canetons comptent sur toi. Ouvre la carte (touche M) si tu te perds.": "The ducklings are counting on you. Open the map (M key) if you get lost.",
    "Les trois canetons sont rentrés ! Merci, Dip Duck.": "All three ducklings are home! Thank you, Dip Duck.",
    "Une Grande Bougie s'est installée aux Ruines du Calme, au sud-est.": "A Great Candle has settled in the Ruins of Calm, to the southeast.",
    "Elle garde la Plume du Calme. Va la chercher, et sois prudent.": "It guards the Feather of Calm. Go get it, and be careful.",
    "La Grande Bougie est aux Ruines du Calme, au sud-est. Suis la route.": "The Great Candle is in the Ruins of Calm, to the southeast. Follow the road.",
    "Le coffre des ruines contient la Plume du Calme. Ouvre-le !": "The chest in the ruins holds the Feather of Calm. Open it!",
    "La Plume du Calme ! L'Étang retrouve son souffle.": "The Feather of Calm! The Pond can breathe again.",
    "Mais j'ai un drôle de pressentiment… Madame Crapaude parle d'époques qui changent.": "But I have a strange feeling… Madam Toad talks about changing eras.",
    "On dit qu'une deuxième Plume dort dans la Forêt Profonde, au bout du sentier nord du Campement des Bois.": "They say a second Feather sleeps in the Deep Forest, at the end of the north path from Woods Camp.",
    "La Forêt Profonde t'attend, au nord du Campement des Bois. Bonne route, petit !": "The Deep Forest awaits you, north of Woods Camp. Safe travels, little one!",
    // Madame Crapaude
    "Je vois… des usines, des machines, des chaînes de blocs… l'Étang ne restera pas un village.": "I see… factories, machines, chains of blocks… the Pond won't stay a village.",
    "En attendant, il me faut des champignons pour mes visions. Rapporte-m'en 12, de la forêt et du marais.": "Meanwhile, I need mushrooms for my visions. Bring me 12, from the forest and the marsh.",
    "Douze champignons ! Mes visions s'éclaircissent.": "Twelve mushrooms! My visions are clearing up.",
    "Tiens : un cœur de plus, pour les épreuves à venir.": "Here: one more heart, for the trials ahead.",
    "Les époques changeront. Garde ton calme, et ne crois jamais un cadeau trop beau pour être vrai.": "The eras will change. Keep calm, and never trust a gift that's too good to be true.",
    // Capitaine Mouette
    "Ahoy, petit canard ! Je suis la Capitaine Mouette.": "Ahoy, little duck! I'm Captain Seagull.",
    "Le phare s'est éteint quand la Bougie Noire s'y est installée. Depuis, les bateaux se perdent.": "The lighthouse went dark when the Black Candle moved in. Ever since, boats get lost.",
    "Prends le long pont vers l'île du phare. Il te faudra le bloc, les bottes ET le grappin.": "Take the long bridge to the lighthouse island. You'll need the block, the boots AND the hook.",
    "Le phare est au bout du long pont, au nord-est.": "The lighthouse is at the end of the long bridge, to the northeast.",
    "Six coquillages ! Merci, moussaillon.": "Six seashells! Thanks, deckhand.",
    "LA LUMIÈRE EST REVENUE ! Regarde le phare briller…": "THE LIGHT IS BACK! Look at the lighthouse shine…",
    "La Bougie Noire n'était que la peur de l'Étang. Tu l'as calmée, Dip Duck.": "The Black Candle was only the Pond's fear. You calmed it, Dip Duck.",
    "Les quatre Plumes du Calme sont réunies. L'Étang te doit tout !": "All four Feathers of Calm are together. The Pond owes you everything!",
    "Le phare guide de nouveau les bateaux, grâce à toi.": "The lighthouse guides the boats again, thanks to you.",
    // Guide des Cimes
    "Bienvenue au Refuge des Cimes, voyageur à plumes !": "Welcome to Summit Lodge, feathered traveler!",
    "La troisième Plume du Calme est tout en haut de la Tour du Vent, au nord.": "The third Feather of Calm is at the very top of the Wind Tower, to the north.",
    "Méfie-toi des rafales : attends qu'elles retombent pour traverser.": "Beware the gusts: wait for them to die down before crossing.",
    "La Tour du Vent est au bout du sentier, au nord du refuge.": "The Wind Tower is at the end of the path, north of the lodge.",
    "Six edelweiss ! Tu as l'œil, petit.": "Six edelweiss! You've got a sharp eye, little one.",
    "La Plume du Vent ! Trois Plumes du Calme réunies.": "The Wind Feather! Three Feathers of Calm gathered.",
    "La Bougie Noire doit trembler… mais repose-toi, la suite viendra.": "The Black Candle must be trembling… but rest now, more will come.",
    "Six edelweiss ! Merci, petit.": "Six edelweiss! Thanks, little one.",
    "Le vent est plus doux depuis que tu es passé.": "The wind has been gentler since you came by.",
    // Chouette Sage
    "Hou-hou… Un canard au cœur calme ! On t'attendait.": "Hoo-hoo… A duck with a calm heart! We were expecting you.",
    "La deuxième Plume du Calme dort au fond du Temple Moussu, au nord de la forêt.": "The second Feather of Calm sleeps deep in the Mossy Temple, north of the forest.",
    "Le temple est plein de gouffres : cherche d'abord le grappin caché dans ses salles.": "The temple is full of chasms: first look for the grappling hook hidden in its rooms.",
    "Le Temple Moussu est au bout du sentier, tout au nord.": "The Mossy Temple is at the end of the path, far to the north.",
    "Oh ! Tu as trouvé mes 8 lucioles ! Merci.": "Oh! You found my 8 fireflies! Thank you.",
    "La Plume de la Forêt ! Deux Plumes du Calme sont réunies.": "The Forest Feather! Two Feathers of Calm are together.",
    "Mais la Bougie Noire n'a pas dit son dernier mot… Repose-toi, petit, la suite viendra.": "But the Black Candle hasn't said its last word… Rest now, little one, more will come.",
    "Mes 8 lucioles ! Merci, petit.": "My 8 fireflies! Thanks, little one.",
    "La forêt respire mieux grâce à toi.": "The forest breathes easier thanks to you.",
    // Castor, Goéland
    "Un caneton ? J'en ai vu un filer vers le marais, au sud. Ça sent la boue là-bas !": "A duckling? I saw one dash toward the marsh, to the south. It smells like mud down there!",
    "Petit conseil de castor : ne montre jamais à tout le monde ce que tu possèdes.": "A little beaver advice: never show everyone what you own.",
    "Du haut de ma tour, j'ai vu un caneton près des montagnes, au nord, et un autre dans la forêt du campement.": "From my tower, I saw a duckling near the mountains, to the north, and another in the camp woods.",
    "Et les ruines au sud-est… une lueur rouge y brille toutes les nuits.": "And the ruins to the southeast… a red glow shines there every night.",
    // messages
    "Parle à Grand-père Grenouille, juste à côté. (Espace / QUACK)": "Talk to Grandpa Frog, right next to you. (Space / QUACK)",
    "Partie reprise. Bon retour à l'Étang !": "Game resumed. Welcome back to the Pond!",
    "Son activé": "Sound on", "Son coupé": "Sound off", "♪ Son": "♪ Sound", "♪ Muet": "♪ Muted",
    "La forêt est trop dense pour la carte ! Suis les sentiers.": "The forest is too dense for the map! Follow the paths.",
    "Pas de carte ici : sors d'abord.": "No map here: go outside first.",
    "Tu es en pleine forme ! Reviens quand tu seras blessé.": "You're in great shape! Come back when you're hurt.",
    "Il te faut 3 pièces. Calme des bougies ou ouvre des coffres !": "You need 3 coins. Calm candles or open chests!",
    "Tarte aux baies : tous tes cœurs sont revenus ! (-3 pièces)": "Berry pie: all your hearts are back! (-3 coins)",
    "Acte I terminé ! 🦆✨": "Act I complete! 🦆✨",
    "La Capitaine t'offre un cœur de plus ! ❤": "The Captain gives you one more heart! ❤",
    "Quête des Monts terminée ! 🦆": "Mountains quest complete! 🦆",
    "Le Guide t'offre un cœur de plus ! ❤": "The Guide gives you one more heart! ❤",
    "Quête de la forêt terminée ! 🦆": "Forest quest complete! 🦆",
    "La Chouette t'offre un cœur de plus ! ❤": "The Owl gives you one more heart! ❤",
    "Fiole de vie : +1 cœur pour toujours ! (-40 pièces)": "Vial of Life: +1 heart forever! (-40 coins)",
    "Tarte aux mûres : cœurs pleins ! (-3 pièces)": "Blackberry pie: full hearts! (-3 coins)",
    "Reviens quand tu seras blessé !": "Come back when you're hurt!",
    "Quête principale terminée ! 🦆": "Main quest complete! 🦆",
    "Un cœur de plus ! ❤": "One more heart! ❤",
    "La lumière du phare brille sur l'Étang. Parle à la Capitaine Mouette.": "The lighthouse light shines over the Pond. Talk to Captain Seagull.",
    "Tu as trouvé la Plume du Calme ! ✨": "You found the Feather of Calm! ✨",
    "Dix bougies calmées ! Retourne voir Grand-père Grenouille.": "Ten candles calmed! Go back to Grandpa Frog.",
    "La Grande Bougie est calmée ! Ouvre le coffre.": "The Great Candle is calm! Open the chest.",
    "Dip Duck se repose au village… et repart, tout calme.": "Dip Duck rests in the village… and heads out again, all calm.",
    "Aïe, ça brûle ! Un coup de bec quand elle est tout près.": "Ouch, that burns! Peck it when it's really close.",
    "Une clé ! Elle ouvre la porte du sommet.": "A key! It opens the top door.",
    "Une clé ! Elle ouvre la porte en haut de la tour.": "A key! It opens the door at the top of the tower.",
    "Une clé ! Elle ouvre la porte au nord du temple.": "A key! It opens the door north of the temple.",
    "Une clé ! Elle ouvre sûrement une porte de la grotte.": "A key! It must open a door in the cave.",
    "Les trois canetons sont saufs ! Retourne au village.": "All three ducklings are safe! Go back to the village.",
    // écran de fin, interface
    "Espace / QUACK : continuer": "Space / QUACK: continue",
    "Fin de l'Acte I": "End of Act I",
    "La Plume de Lumière rallume le phare.": "The Feather of Light relights the lighthouse.",
    "La Bougie Noire n'était que la peur de l'Étang. Dip Duck l'a calmée.": "The Black Candle was only the Pond's fear. Dip Duck calmed it.",
    "Mais au loin, une fumée d'usine s'élève… les époques commencent à changer.": "But in the distance, factory smoke rises… the eras are starting to change.",
    "Merci d'avoir joué à Dip Duck : Les Plumes du Calme. À suivre dans l'Acte II !": "Thanks for playing Dip Duck: The Calm Feathers. To be continued in Act II!",
    "Espace / QUACK : continuer à explorer": "Space / QUACK: keep exploring",
    // page (boutons, réglages)
    "Saison": "Season", "Carte": "Map", "⚙ Réglages": "⚙ Settings", "OBJET": "ITEM", "Réglages du son": "Sound settings",
    "Volume général": "Main volume", "Musique": "Music", "Bruitages": "Sound effects", "Ambiance": "Ambience",
    "Couper le son": "Mute", "Remettre le son": "Unmute", "Fermer": "Close", "BÊTA": "BETA",
    "Flèches ou ZQSD/WASD : marcher · Espace : parler / coup de bec · X : objet · C : changer d'objet · M : carte · N : saison · V : couper le son · Échap : réglages":
      "Arrows or WASD: walk · Space: talk / peck · X: item · C: switch item · M: map · N: season · V: mute · Esc: settings",
    "Version": "The", "bêta": "beta",
    "de l'Acte I : la partie est sauvegardée dans ce navigateur. Un souci ? Écrivez-nous sur": "of Act I: your game is saved in this browser. A problem? Message us on",
    "← Retour à dipduck.xyz": "← Back to dipduck.xyz",
    "· Jeu gratuit, sans achat, sans aucune récompense de valeur.": "· Free game, no purchases, no rewards of any value.",
  };

  // ---- textes avec des parties variables : {} = un morceau (lui-même traduit) ----
  const MODELES = [
    ["★ {}", "★ {}"],
    ["Espace : parler à {}", "Space: talk to {}"],
    ["Espace : entrer — {}", "Space: enter — {}"],
    ["{} garde le coffre ! Calme-le d'abord.", "{} guards the chest! Calm it down first."],
    ["{} est calmé ! Le coffre est libre.", "{} is calm! The chest is free."],
    ["Objet (X) : {}  ·  C : changer", "Item (X): {}  ·  C: switch"],
    ["Objet (X) : {}", "Item (X): {}"],
    ["Objet : {}", "Item: {}"],
    ["Saison : {}", "Season: {}"],
    ["Carte : {} — jaune = objectif · bleu = passage · M ou Espace pour fermer", "Map: {} — yellow = goal · blue = passage · M or Space to close"],
    ["{} : encore {} !", "{}: {} more!"],
    ["Calme 10 bougies rouges dans les champs et les prés ({}/10).", "Calm 10 red candles in the fields and meadows ({}/10)."],
    ["Retrouve les 3 canetons perdus ({}/3).", "Find the 3 lost ducklings ({}/3)."],
    ["Encore des champignons, petit : {}/12.", "More mushrooms, little one: {}/12."],
    ["Ramène-moi des coquillages de la plage : {}/6.", "Bring me seashells from the beach: {}/6."],
    ["Mes coquillages : {}/6.", "My seashells: {}/6."],
    ["Si tu trouves des edelweiss près des falaises, apporte-les-moi : {}/6.", "If you find edelweiss near the cliffs, bring them to me: {}/6."],
    ["Mes edelweiss : {}/6.", "My edelweiss: {}/6."],
    ["Si tu croises des lucioles, ramène-les-moi : {}/8.", "If you come across fireflies, bring them to me: {}/8."],
    ["Mes lucioles, petit : {}/8.", "My fireflies, little one: {}/8."],
    ["La Fiole coûte 40 pièces. Tu en as {}.", "The Vial costs 40 coins. You have {}."],
    ["Bougie calmée ! ({} au total)", "Candle calmed! ({} total)"],
    ["Grande Bougie : encore {} coups de bec !", "Great Candle: {} more pecks!"],
    ["Plume dorée ! ({}/100)", "Golden feather! ({}/100)"],
    ["Coquillage ! ({}/6) — la Capitaine les collectionne.", "Seashell! ({}/6) — the Captain collects them."],
    ["Edelweiss ! ({}/6) — le Guide des Cimes les aime.", "Edelweiss! ({}/6) — the Summit Guide loves them."],
    ["Luciole ! ({}/8) — la Chouette Sage les collectionne.", "Firefly! ({}/8) — the Wise Owl collects them."],
    ["Pièce ! ({})", "Coin! ({})"],
    ["Champignon ! ({}/12) — Madame Crapaude en cherche…", "Mushroom! ({}/12) — Madam Toad is looking for some…"],
    ["Champignon ! ({}/12)", "Mushroom! ({}/12)"],
    ["Caneton retrouvé ! ({}/3)", "Duckling found! ({}/3)"],
    ["Plumes {}/100 · Lucioles {}/8 · Edelweiss {}/6 · Coquillages {}/6 · Champignons {}/12 · Canetons {}/3",
     "Feathers {}/100 · Fireflies {}/8 · Edelweiss {}/6 · Shells {}/6 · Mushrooms {}/12 · Ducklings {}/3"],
    ["Temps de jeu : {} h {} · Plumes dorées : {}/100 · Cœurs : {} · Pièces : {}",
     "Play time: {} h {} · Golden feathers: {}/100 · Hearts: {} · Coins: {}"],
  ].map(([fr, en]) => [new RegExp("^" + fr.split("{}").map((p) => p.replace(/[.*+?^$()|[\]\\]/g, "\\$&")).join("(.+?)") + "$", "s"), en]);

  const cache = new Map();
  function T(s) {
    if (lang === "fr" || typeof s !== "string" || !s) return s;
    const d = EN[s]; if (d !== undefined) return d;
    const c = cache.get(s); if (c !== undefined) return c;
    let r = s;
    for (const [re, en] of MODELES) { const m = s.match(re); if (m) { let k = 1; r = en.replace(/\{\}/g, () => T(m[k++])); break; } }
    if (cache.size > 4000) cache.clear();
    cache.set(s, r); return r;
  }
  window.T = T;
  if (lang === "fr") return;

  // le canevas : tout texte dessiné (et mesuré, pour garder la mise en page juste) est traduit
  const P = CanvasRenderingContext2D.prototype, fill = P.fillText, stroke = P.strokeText, mes = P.measureText;
  P.fillText = function (t, ...a) { return fill.call(this, T(String(t)), ...a); };
  P.strokeText = function (t, ...a) { return stroke.call(this, T(String(t)), ...a); };
  P.measureText = function (t) { return mes.call(this, T(String(t))); };
  if (window.OffscreenCanvasRenderingContext2D) { const O = OffscreenCanvasRenderingContext2D.prototype, of = O.fillText, om = O.measureText;
    O.fillText = function (t, ...a) { return of.call(this, T(String(t)), ...a); }; O.measureText = function (t) { return om.call(this, T(String(t))); }; }

  // la page : textes des boutons et du panneau
  function traduirePage() {
    document.documentElement.lang = "en";
    document.title = "Dip Duck: The Calm Feathers — Act I (beta)";
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) { const t = n.nodeValue.trim(); if (!t) continue; const e = T(t); if (e !== t) n.nodeValue = n.nodeValue.replace(t, e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", traduirePage); else traduirePage();
})();
