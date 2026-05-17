import type {
  CampusEvent,
  Community,
  Drop,
  LostFound,
  Post,
  PostComment,
  Report,
  Student,
  StudyGroup,
  Trend,
} from "./types";

export const me: Student = {
  name: "Sergio Matos",
  handle: "serginho",
  course: "Sistemas de Informacao",
  semester: "5th semester",
  campus: "Unifacs Salvador",
  avatar: "SM",
};

export const students: Student[] = [
  me,
  {
    name: "Lia Andrade",
    handle: "lia.codes",
    course: "Engenharia de Software",
    semester: "3rd semester",
    campus: "Unifacs Salvador",
    avatar: "LA",
  },
  {
    name: "Rafa Nunes",
    handle: "rafanunes",
    course: "Publicidade",
    semester: "6th semester",
    campus: "Unifacs Rio Vermelho",
    avatar: "RN",
  },
  {
    name: "Maya Costa",
    handle: "mayacosta",
    course: "Psicologia",
    semester: "4th semester",
    campus: "Unifacs Tancredo",
    avatar: "MC",
  },
  {
    name: "Theo Lima",
    handle: "theolima",
    course: "Design",
    semester: "2nd semester",
    campus: "Unifacs Salvador",
    avatar: "TL",
  },
];

export const initialPosts: Post[] = [
  {
    id: 1,
    author: students[1],
    time: "8 min",
    body: "A sala 304 virou coworking improvisado hoje. Quem precisa terminar o prototipo de IHC cola aqui.",
    mood: "focused 💻",
    image:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80",
    tags: ["#IHC", "#PrototypeNight"],
    community: "Tech Lab",
    reactions: { yep: 42, nope: 1, loud: 13, mood: 9, iconic: 7, in: 16 },
    comments: 4,
    shares: 5,
  },
  {
    id: 2,
    author: students[2],
    time: "19 min",
    body: "Confirmado: ensaio aberto da bateria no patio as 18h. Quem filmar, marca #CampusBeat.",
    mood: "loud 🥁",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    tags: ["#CampusBeat", "#AfterClass"],
    community: "Eventos",
    reactions: { yep: 88, nope: 2, loud: 31, mood: 18, iconic: 21, in: 44 },
    comments: 3,
    shares: 19,
  },
  {
    id: 3,
    author: students[3],
    time: "31 min",
    body: "Alguem tem resumo de estatistica aplicada? Tenho cafe e eterna gratidao como moeda.",
    mood: "desperate 😵",
    tags: ["#StudySOS", "#Estatistica"],
    community: "Study Hub",
    reactions: { yep: 23, nope: 0, loud: 2, mood: 30, iconic: 4, in: 8 },
    comments: 2,
    shares: 2,
  },
  {
    id: 4,
    author: students[4],
    time: "47 min",
    body: "O mural fisico perto da biblioteca ta cheio de cartaz bom hoje. TheYep precisava ter uma versao disso.",
    mood: "inspired 🎨",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    tags: ["#Mural", "#Design"],
    community: "Design Circle",
    reactions: { yep: 57, nope: 1, loud: 4, mood: 16, iconic: 12, in: 10 },
    comments: 2,
    shares: 6,
  },
];

export const initialComments: Record<number, PostComment[]> = {
  1: [
    {
      id: "c-1-1",
      author: students[4],
      time: "5 min",
      body: "Se tiver tomada livre eu levo meu notebook e ajudo no fluxo.",
      replies: [
        {
          id: "c-1-1-r-1",
          author: students[1],
          time: "3 min",
          body: "Tem sim, lado esquerdo da sala ta tranquilo.",
          replies: [],
        },
      ],
    },
    {
      id: "c-1-2",
      author: students[3],
      time: "2 min",
      body: "Isso salvou meu grupo, indo agora.",
      replies: [
        {
          id: "c-1-2-r-1",
          author: me,
          time: "now",
          body: "Marca #PrototypeNight depois, quero ver esse caos organizado.",
          replies: [],
        },
      ],
    },
  ],
  2: [
    {
      id: "c-2-1",
      author: students[1],
      time: "13 min",
      body: "Se rolar setlist eu quero muito a primeira musica.",
      replies: [
        {
          id: "c-2-1-r-1",
          author: students[2],
          time: "9 min",
          body: "Vai abrir com a classica, pode chegar gritando.",
          replies: [],
        },
      ],
    },
    {
      id: "c-2-2",
      author: students[4],
      time: "7 min",
      body: "Vou filmar uns cortes pro Design Circle.",
      replies: [],
    },
  ],
  3: [
    {
      id: "c-3-1",
      author: students[1],
      time: "14 min",
      body: "Tenho um PDF com as formulas principais.",
      replies: [
        {
          id: "c-3-1-r-1",
          author: students[3],
          time: "11 min",
          body: "Voce e oficialmente uma lenda.",
          replies: [],
        },
      ],
    },
  ],
  4: [
    {
      id: "c-4-1",
      author: students[2],
      time: "28 min",
      body: "A versao digital disso precisa ter destaque por campus.",
      replies: [],
    },
    {
      id: "c-4-2",
      author: students[1],
      time: "18 min",
      body: "E filtro por curso tambem. Seria perfeito.",
      replies: [],
    },
  ],
};

export const initialDrops: Drop[] = [
  {
    id: 1,
    author: students[2],
    kind: "photo",
    body: "Backstage do ensaio",
    image:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
    expiresIn: "23h",
    viewers: 218,
    tags: ["#CampusBeat"],
  },
  {
    id: 2,
    author: students[1],
    kind: "text",
    body: "Debug coletivo na 304 ate a energia acabar.",
    expiresIn: "21h",
    viewers: 104,
    tags: ["#IHC"],
  },
  {
    id: 3,
    author: students[3],
    kind: "photo",
    body: "Biblioteca silenciosa de verdade hoje.",
    image:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
    expiresIn: "18h",
    viewers: 86,
    tags: ["#StudySOS"],
  },
];

export const trends: Trend[] = [
  { tag: "#CampusBeat", posts: 148, scope: "Unifacs", heat: 96 },
  { tag: "#StudySOS", posts: 92, scope: "All campuses", heat: 82 },
  { tag: "#PrototypeNight", posts: 67, scope: "Tech courses", heat: 73 },
  { tag: "#Mural", posts: 54, scope: "Salvador", heat: 68 },
  { tag: "#AfterClass", posts: 41, scope: "Events", heat: 61 },
];

export const communities: Community[] = [
  {
    id: 1,
    name: "Tech Lab",
    category: "Course",
    members: 428,
    accent: "#00b8d9",
    description: "Projetos, vagas, hackathons e aquele bug que so aparece no dia da entrega.",
    topPost: "Lista de APIs gratuitas para projeto final",
  },
  {
    id: 2,
    name: "Study Hub",
    category: "Academic",
    members: 731,
    accent: "#8bd346",
    description: "Resumos, monitorias, grupos de estudo e pedidos de socorro academico.",
    topPost: "Mapa de provas da semana",
  },
  {
    id: 3,
    name: "Eventos",
    category: "Campus life",
    members: 532,
    accent: "#ff2d75",
    description: "Festas, palestras, workshops, chamadas de atléticas e encontros no patio.",
    topPost: "Agenda de sexta ja esta absurda",
  },
  {
    id: 4,
    name: "Design Circle",
    category: "Creative",
    members: 219,
    accent: "#ffbc1f",
    description: "Portfolio, referencias, critiques rapidas e collabs criativas.",
    topPost: "Feedback sprint: manda sua tela",
  },
];

export const events: CampusEvent[] = [
  {
    id: 1,
    title: "Open mic no patio",
    date: "Today, 18:00",
    location: "Patio central",
    category: "Culture",
    attendees: 74,
  },
  {
    id: 2,
    title: "Workshop de IA aplicada",
    date: "Tomorrow, 14:00",
    location: "Lab 4",
    category: "Tech",
    attendees: 126,
  },
  {
    id: 3,
    title: "Reuniao da atletica",
    date: "Fri, 17:30",
    location: "Quadra",
    category: "Sports",
    attendees: 58,
  },
];

export const studyGroups: StudyGroup[] = [
  {
    id: 1,
    subject: "Estatistica aplicada",
    host: students[3],
    time: "Today, 16:00",
    place: "Biblioteca, mesa 6",
    seats: 5,
  },
  {
    id: 2,
    subject: "Banco de Dados II",
    host: students[1],
    time: "Tomorrow, 09:30",
    place: "Discord + Lab 2",
    seats: 8,
  },
  {
    id: 3,
    subject: "Pesquisa de mercado",
    host: students[2],
    time: "Thu, 15:00",
    place: "Patio lateral",
    seats: 4,
  },
];

export const lostFound: LostFound[] = [
  {
    id: 1,
    status: "Found",
    item: "Estojo amarelo",
    location: "Biblioteca",
    contact: "@mayacosta",
    image:
      "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    status: "Lost",
    item: "Garrafa preta",
    location: "Lab 4",
    contact: "@lia.codes",
  },
  {
    id: 3,
    status: "Found",
    item: "Carteira de estudante",
    location: "Patio central",
    contact: "@rafanunes",
  },
];

export const initialReports: Report[] = [
  {
    id: 1,
    target: "Drop #CampusBeat",
    reason: "Pessoa aparece no video sem consentimento",
    severity: "Medium",
    status: "Reviewing",
  },
  {
    id: 2,
    target: "Post em Study Hub",
    reason: "Resposta agressiva nos comentarios",
    severity: "Low",
    status: "Open",
  },
];
