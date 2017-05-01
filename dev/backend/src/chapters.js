const chapter = require('../../scrapjs/parts/chapter');
const mustache = require('mustache');
const accounts = require('./accounts');
const mongoutils = require('./mongoutils');
const pdf = require('./pdf');
const fs = require('fs');
const promisify = require('es6-promisify');
const lescape = require('escape-latex');

const readdir = promisify(fs.readdir);

const chapterTmpl = `

\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{setspace}
\\usepackage{comment}
\\usepackage{bigstrut}
\\usepackage{geometry}
\\usepackage{supertabular}
\\usepackage{tabu}
\\usepackage{hyperref}
\\usepackage{url}
\\hypersetup{
  colorlinks=true, linkcolor=blue, citecolor=blue, filecolor=blue, urlcolor=blue}
\\geometry{textheight=9.5in, textwidth=7in}
\\usepackage{fontspec}
\\defaultfontfeatures{Ligatures=TeX}
\\usepackage[small,sf,bf]{titlesec}
\\usepackage{fvextra}
\\DefineVerbatimEnvironment{plainraw}
  {Verbatim}
  {fontfamily=\\rmdefault,breaklines,breaksymbolleft={}}
\\title{ {{{title}}} }
\\author{ {{{author}}} }

\\begin{document}
\\maketitle
\\begin{plainraw}

{{{ body }}}
\\end{plainraw}
\\end{document}
`;

const getUnassociatedChapters = async function (request, reply) {
  const login = await accounts.verifylogin(request, reply);
  if (!login.success) {
    return reply({ error: 'could not verify identity', reason: login.reason }).code(403);
  }
  const cursor = await global.db.collection('refs').find({ author: login.username, type: 'chapter', count: 0 });
  const unassoc = await cursor.toArray();
  unassoc.map((e) => {
    delete e._id;
    delete e.count;
    return e;
  });
  return reply(unassoc);
};

const getChapterById = async function (request, reply) {
  const c = await chapter.reconstitute(request.params.author, request.params.id);
  c.scraps = await chapter.fleshOut(c.scraps);
  return reply(c);
};

const postChapterById = async function (request, reply) {
  const login = await accounts.verifylogin(request);
  if (!login.success) {
    return reply({ error: 'could not verify identity' }).code(403);
  }
  if (login.username !== request.params.author) {
    return reply({ error: 'not your chapter!' }).code(403);
  }
  const c = await chapter.reconstitute(request.params.author, request.params.id);
  const err = await c.update(request.payload);
  if (err.error) {
    return reply(err).code(403);
  }
  if (Array.isArray(request.payload.scraps)) {
    mongoutils.countRefs(c.scraps, request.payload.scraps, request.params.author);
  }
  await global.search.update({
    index: 'mvp',
    type: 'chapter',
    id: `${c.author}-${c.uuid}`,
    body: {
      doc: c,
    },
  });
  return reply(err);
};

const generateChapterPdf = async function (request, reply) {
  const c = await chapter.reconstitute(request.params.author, request.params.id);

  const [chapterText, authors] = await c.getText();
  const authorFullNames = await accounts.fullNames(authors);
  const authorText = authorFullNames.join(' \\and ');
  const info = {
    title: lescape(c.name),
    author: authorText,
    body: chapterText,
  };
  const laText = mustache.render(chapterTmpl, info); // lol laText
  const pdfPath = await pdf.gen(laText);

  return reply.file(pdfPath);
};

const getChapterHistory = async function (request, reply) {
  const c = await chapter.reconstitute(request.params.author, request.params.id);
  const versions = await c.previousVersions();
  return reply(versions.map(v => [v[0], v[1]])); // remove the Commit object field
};

const postNewChapter = async function (request, reply) {
  const login = await accounts.verifylogin(request);
  if (!login.success) {
    return reply({ error: 'could not verify identity' }).code(403);
  }
  if (request.payload.author === undefined) {
    return reply({ error: 'must define author' }).code(403);
  }
  if (request.payload.author !== login.username) {
    return reply({ error: `can only create chapters for ${login.username}` }).code(403);
  }
  if (request.payload.name === undefined) {
    return reply({ error: 'must define name' }).code(403);
  }
  const ch1 = new chapter.Chapter(request.payload.name, request.payload.author);
  await ch1.save(`Created chapter named ${request.payload.name}`);

  await global.search.create({
    index: 'mvp',
    type: 'chapter',
    id: `${ch1.author}-${ch1.uuid}`,
    body: {
      doc: ch1,
    },
  });
  await global.db.collection('refs').insertOne({
    count: 0,
    type: 'chapter',
    name: request.payload.name,
    author: request.payload.author,
    uuid: ch1.uuid,
  });
  return reply(ch1);
};

// /chapters/{author}
const getChaptersByAuthor = async function (request, reply) {
  const login = await accounts.verifylogin(request);
  const chapters = [];
  try {
    const dirs = await readdir(`${global.storage + request.params.author}/chapter`);
    for (const dir of dirs) {
      const b = await chapter.reconstitute(request.params.author, dir);
      b.scraps = await chapter.fleshOut(b.scraps);
      chapters.push(b);
    }
  } catch (e) {
    // TODO should return successful but empty for existing user with no chapters
    return reply({ error: `no chapters for user ${request.params.author} found` }).code(404);
  }
  if (login.success) {
    for (let chapter of chapters) {
      chapter.favorite = await mongoutils.isFav("chapter", chapter, login.username);
    }
  }
  return reply(chapters);
};

// /chapters/{author}/{id}/fork
const forkChapterById = async function (request, reply) {
  const login = await accounts.verifylogin(request);
  if (!login.success) {
    return reply({ error: 'could not verify identity' }).code(403);
  }
  const c = await chapter.reconstitute(request.params.author, request.params.id);
  const cFork = await c.fork(login.username);
  return reply(cFork);
};

// /chapters/{author}/{id}/favorite
const favoriteChapterById = async function (request, reply) {
  const login = await accounts.verifylogin(request);
  if (!login.success) {
    return reply({ error: 'could not verify identity' }).code(403);
  }
  return reply(await accounts.favoriteThing(login.username, 'chapter', request.params.author, request.params.id));
};

// /chapters/{author}/{id}/favorite
const unfavoriteChapterById = async function (request, reply) {
  const login = await accounts.verifylogin(request);
  if (!login.success) {
    return reply({ error: 'could not verify identity' }).code(403);
  }
  return reply(await accounts.unfavoriteThing(login.username, 'chapter', request.params.author, request.params.id));
};

const routes = [{
  method: 'GET',
  path: '/chapters/{author}/{id}',
  handler: getChapterById,
},
{
  method: 'GET',
  path: '/chapters/{author}',
  handler: getChaptersByAuthor,
},
{
  method: 'POST',
  path: '/chapters/{author}/{id}',
  handler: postChapterById,
},
{
  method: 'POST',
  path: '/chapters/{author}/{id}/fork',
  handler: forkChapterById,
},
{
  method: 'POST',
  path: '/chapters/{author}/{id}/favorite',
  handler: favoriteChapterById,
},
{
  method: 'DELETE',
  path: '/chapters/{author}/{id}/favorite',
  handler: unfavoriteChapterById,
},
{
  method: 'GET',
  path: '/chapters/{author}/{id}/pdf',
  handler: generateChapterPdf,
},
{
  method: 'GET',
  path: '/chapters/{author}/{id}/history',
  handler: getChapterHistory,
},
{
  method: 'GET',
  path: '/chapters/unassociated',
  handler: getUnassociatedChapters,
},
{
  method: 'POST',
  path: '/chapters/new',
  handler: postNewChapter,
},
];

const register = function (server) {
  for (const route of routes) {
    server.route(route);
  }
};

module.exports = { register };
