import { describe, expect, it } from "vitest";
import { parseZippopotamFsaPayload } from "@/lib/geocode";

describe("parseZippopotamFsaPayload", () => {
  it("reads the Granby J2G centroid", () => {
    const loc = parseZippopotamFsaPayload(
      {
        "post code": "J2G",
        places: [
          {
            "place name": "Granby Central",
            longitude: "-72.7103",
            state: "Quebec",
            "state abbreviation": "QC",
            latitude: "45.4109",
          },
        ],
      },
      "J2G",
    );
    expect(loc).toMatchObject({
      lat: 45.4109,
      lng: -72.7103,
      city: "Granby Central",
      province: "QC",
      postal: "J2G",
    });
  });

  it("rejects a payload without coordinates", () => {
    expect(parseZippopotamFsaPayload({ places: [{ "place name": "Granby" }] }, "J2G")).toBeNull();
  });

  it("rejects a non-FSA code", () => {
    expect(
      parseZippopotamFsaPayload(
        { places: [{ latitude: "45.4", longitude: "-72.7", "place name": "X" }] },
        "J2G1A1",
      ),
    ).toBeNull();
  });
});
