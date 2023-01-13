/* eslint-disable no-undef */
const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

function fetchCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let response = await agent.get("/login");
  let csrfToken = fetchCsrfToken(response);
  response = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Online election suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(process.env.PORT || 4000, () => {});
    agent = request.agent(server);
  });
  afterAll(async () => {
    await db.sequelize.close();
    server.close();
  });

  test("Test for Signup", async () => {
    let response = await agent.get("/signup");
    const csrfToken = fetchCsrfToken(response);
    response = await agent.post("/admin").send({
      firstName: "Anshu",
      lastName: "Vasantham",
      email: "user.a@gmail.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Test for Sign in", async () => {
    const agent = request.agent(server);
    let res = await agent.get("/elections");
    expect(res.statusCode).toBe(302);
    await login(agent, "user.a@gmail.com", "12345678");
    res = await agent.get("/elections");
    expect(res.statusCode).toBe(200);
  });

  test("Test for Sign Out", async () => {
    let response = await agent.get("/elections");
    expect(response.statusCode).toBe(200);
    response = await agent.get("/signout");
    expect(response.statusCode).toBe(302);
    response = await agent.get("/elections");
    expect(response.statusCode).toBe(302);
  });

  test("New user signup", async () => {
    let res = await agent.get("/signup");
    const csrfToken = fetchCsrfToken(res);
    res = await agent.post("/admin").send({
      firstName: "Anshu",
      lastName: "Vasantham",
      email: "user.c@gmail.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Test the creation of election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@gmail.com", "12345678");
    const getResponse = await agent.get("/elections/create");
    const csrfToken = fetchCsrfToken(getResponse);
    const response = await agent.post("/elections").send({
      electionName: "Test election",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });
});
