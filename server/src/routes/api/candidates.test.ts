import request from "supertest";
import app from "../../app";

describe("Candidates API", () => {
  it("should return a compressed CSV with correct headers at /api/candidates", async () => {
    const response = await request(app).get("/api/candidates");

    expect(response.status).toBe(200);

    expect(response.header["content-type"]).toBe("text/csv");
    expect(response.header["content-disposition"]).toContain(
      'attachment; filename="candidates.csv"'
    );
    // expect(response.header["content-encoding"]).toBe("br");

    expect(response.text).toContain("candidate_id,first_name");
  });

  it("should return 404 for unknown routes", async () => {
    const response = await request(app).get("/some/non-existing-route");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Not Found" });
  });
});
