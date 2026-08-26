export const ANIMAL_METADATA = [
    { name: 'White-tailed Deer', scientific: 'Odocoileus virginianus', file: 'Deer.gltf', habitat: 'Forest edges', diet: 'Leaves, grass, and berries', behavior: 'Alert and gentle', status: 'Least Concern', fact: 'Its white tail warns the herd of danger.', description: 'A graceful forest friend that helps keep plants growing in balance.', emoji: '🦌' },
    { name: 'Domestic Horse', scientific: 'Equus caballus', file: 'Horse.gltf', habitat: 'Open grassland', diet: 'Grass, hay, and grains', behavior: 'Social and curious', status: 'Domesticated', fact: 'Horses can sleep standing up.', description: 'A strong, kind companion that loves wide spaces and caring people.', emoji: '🐎' },
    { name: 'Ostrich', scientific: 'Struthio camelus', file: 'ostrich/scene.gltf', habitat: 'Dry grassland', diet: 'Plants and small insects', behavior: 'Fast runner', status: 'Least Concern', fact: "It is the world's largest living bird.", description: 'A tall bird with powerful legs and a very speedy run.', emoji: '🦤' },
    { name: 'Donkey', scientific: 'Equus asinus', file: 'Donkey.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Patient and hardworking', status: 'Domesticated', fact: 'Long ears help donkeys stay cool.', description: 'A sure-footed helper with a calm and friendly nature.', emoji: '🐴' },
    { name: 'Domestic Cow', scientific: 'Bos taurus', file: 'Cow.gltf', habitat: 'Pastures and farms', diet: 'Grass and hay', behavior: 'Gentle herd animal', status: 'Domesticated', fact: 'Cows have excellent memories.', description: 'A peaceful grazer that enjoys living with its herd.', emoji: '🐄' },
    { name: 'Alpaca', scientific: 'Vicugna pacos', file: 'Alpaca.gltf', habitat: 'Mountain grasslands', diet: 'Grass and plants', behavior: 'Quiet and social', status: 'Domesticated', fact: 'Its fleece is soft and warm.', description: 'A fluffy South American camelid, prized for its soft fleece.', emoji: '🦙' },
    { name: 'Red Deer Stag', scientific: 'Cervus elaphus', file: 'Stag.gltf', habitat: 'Woodlands', diet: 'Plants and grasses', behavior: 'Protective and alert', status: 'Least Concern', fact: 'A stag grows a new set of antlers each year.', description: 'A majestic deer whose antlers show how healthy it is.', emoji: '🦌' },
    { name: 'Bull', scientific: 'Bos taurus', file: 'Bull.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Strong and watchful', status: 'Domesticated', fact: 'Bulls can recognize familiar faces.', description: 'A powerful bovine that deserves space, patience, and care.', emoji: '🐂' },
    { name: 'Forest Monkey', scientific: 'Macaca fascicularis', file: 'monkey/scene.gltf', habitat: 'Tropical forest', diet: 'Fruit, seeds, and insects', behavior: 'Playful and clever', status: 'Least Concern', fact: 'Monkeys use many different calls to communicate.', description: 'A clever climber that helps spread seeds through the forest.', emoji: '🐒' },
    { name: 'Rabbit', scientific: 'Oryctolagus cuniculus', file: 'rabbit/scene.gltf', habitat: 'Meadows and woodland edges', diet: 'Grass, herbs, and vegetables', behavior: 'Quiet and quick', status: 'Least Concern', fact: "A rabbit's teeth keep growing throughout its life.", description: 'A small, speedy friend with a twitching nose and soft fur.', emoji: '🐇' },
    { name: 'Bengal Tiger', scientific: 'Panthera tigris tigris', file: 'tiger/scene.gltf', habitat: 'Forests and grasslands', diet: 'Meat', behavior: 'Solitary and stealthy', status: 'Endangered', fact: 'Every tiger has a unique stripe pattern.', description: 'A magnificent big cat that needs protected forests to survive.', emoji: '🐅' }
];

export const ANIMAL_METADATA_BY_NAME = Object.fromEntries(ANIMAL_METADATA.map((animal) => [animal.name, animal]));

export function getAnimalBookEntry(name) {
    if (name === 'Rabbit (Idle)' || name === 'Rabbit (Walk)') return ANIMAL_METADATA_BY_NAME.Rabbit;
    return ANIMAL_METADATA_BY_NAME[name];
}
