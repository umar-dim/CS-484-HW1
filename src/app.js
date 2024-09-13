import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { and, count, eq, ilike, asc, like, sql } from "drizzle-orm";
import { Hono } from "hono";
import { html } from "hono/html";
import { db } from "./db.js";
import { product } from "./schema.js";
import { generateHTML } from "./template.js";
import esMain from "es-main";

export const start_server = () => {
  const PORT = process.env.PORT || 3000;
  const app = new Hono();
  
  function searchPagination(totalPages, currentPage, query) {
    const links = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage) {
        links.push(html`<span class="active">${i}</span>`);
      } else {
        links.push(html`
          <a href="/?query=${encodeURIComponent(query)}&page=${i}">${i}</a>
        `);
      }
    }
    return links;
  }

  app.get("/public/*", serveStatic({ root: "./" }));

  

  app.get("/", async (c) => {
		console.log("GET /");

		// Retrieve query and page parameters, provide a default for page if not provided
		const query = c.req.query("query") || ""; // Default to empty string if query is not provided
		const page = parseInt(c.req.query("page")) || 1; // Default to page 1 if not provided or invalid

		console.log("query:", query, "page:", page);

		const data = {
			title: "EZ Store",
			products: [],
			paginationLinks: [],
			status: "",
			query: query,
		};

		// Build the query for searching products
		let dbQuery = db.select().from(product);

		// If a search query is provided, filter the products by name or description
		if (query) {
			dbQuery = dbQuery.where(
				like(sql`LOWER(${product.name})`, `%${query.toLowerCase()}%`) // Search by product name
			);
		}

		const products = await dbQuery.all();

		// Calculate pagination details
		const totalPages = Math.ceil(products.length / 10); // 10 items per page
		const currentPage = Math.min(Math.max(page, 1), totalPages); // Ensure current page is within valid range
		const offset = (currentPage - 1) * 10;

		console.log("offset", offset);

		// Slice products for current page
		data.products = products.slice(offset, offset + 10);
		data.paginationLinks = searchPagination(totalPages, currentPage, query);

		return c.html(generateHTML(data));
	});

  // Delete a product
  app.post("/delete", async (c) => {
    const body = await c.req.parseBody();
    console.log(body);
    const { productID } = body;
    const result = await db
			.delete(product)
			.where(eq(product.id, productID))
			.run();
    return c.redirect("/");
  });

  // Create a new product
  app.post("/add", async (c) => {
    const body = await c.req.parseBody();
    console.log(body);
    const { name, image_url } = body;

    if (!name || !image_url) {
      return c.redirect("/");
    }

    await db
      .insert(product) // Insert new product
      .values({ name: name, image_url: image_url, deleted: 0 }) // Set values
    

    return c.redirect("/");

  });

  serve({ fetch: app.fetch, port: PORT });
  console.log(`Server is running at http://localhost:${PORT}`);
  return app;
};

if (esMain(import.meta)) {
  start_server();
}
