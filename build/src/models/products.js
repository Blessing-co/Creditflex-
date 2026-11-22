/* MODEL: the product catalogue and product photos. */
const Products = {
  all: () => cfLoadAll("products", "id,name,price,image_url,in_stock", ["name", "id"]),
  allForBulk: () => cfLoadAll("products", "id,name,price,in_stock,image_url", ["name", "id"]),
  inStock: () => cfRead("reg:products", () => sb.from("products").select("id,name,price").eq("in_stock", true).order("name")),
  save: (row, id) => id ? sb.from("products").update(row).eq("id", id) : sb.from("products").insert(row),
  insertMany: rows => sb.from("products").insert(rows),
  insertOne: row => sb.from("products").insert(row),
  update: (id, patch) => sb.from("products").update(patch).eq("id", id),
  uploadPhoto: (path, file, type) => sb.storage.from("product-images").upload(path, file, { contentType: type }),
  photoUrl: path => sb.storage.from("product-images").getPublicUrl(path).data.publicUrl
};
