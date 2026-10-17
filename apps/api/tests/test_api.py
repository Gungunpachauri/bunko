def upload(client, path, **form):
    with open(path, "rb") as fh:
        return client.post("/api/books", files={"file": (path.name, fh)}, data=form)


def test_default_rooms_exist(client):
    genres = client.get("/api/library").json()["genres"]
    assert {"fiction", "selfhelp"} <= {g["id"] for g in genres}


def test_upload_epub_becomes_ready_with_cover_toc_and_file(client, files):
    r = upload(client, files["epub"], genre_id="fiction")
    assert r.status_code == 201, r.text
    book_id = r.json()["id"]

    book = client.get(f"/api/books/{book_id}").json()
    assert book["status"] == "ready", book["error"]
    assert book["title"] == "The Grey Harbour"
    assert book["author"] == "A. Tester"
    assert book["has_cover"] is True

    toc = client.get(f"/api/books/{book_id}/toc").json()
    assert [t["title"] for t in toc] == ["Chapter I. The Harbour", "Chapter II. The Whale", "Chapter III. Home"]
    assert client.get(f"/api/books/{book_id}/cover").headers["content-type"] == "image/png"
    f = client.get(f"/api/books/{book_id}/file")
    assert f.status_code == 200 and f.content.startswith(b"PK")


def test_upload_pdf_into_a_new_genre_creates_a_room(client, files):
    r = upload(client, files["pdf"], new_genre="Space & Astronomy")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["genre_id"] == "space-astronomy"
    genres = {g["id"]: g for g in client.get("/api/genres").json()}
    assert genres["space-astronomy"]["theme"] == "space"
    book = client.get(f"/api/books/{body['id']}").json()
    assert book["status"] == "ready" and book["total_pages"] == 3


def test_rejects_other_formats_and_missing_genre(client, tmp_path):
    txt = tmp_path / "notes.txt"
    txt.write_text("hello")
    assert upload(client, txt, genre_id="fiction").status_code == 415
    epub = tmp_path / "x.epub"
    epub.write_bytes(b"PK")
    assert upload(client, epub).status_code == 400


def test_broken_file_is_marked_failed(client, tmp_path):
    bad = tmp_path / "broken.epub"
    bad.write_bytes(b"not really an epub")
    book_id = upload(client, bad, genre_id="fiction").json()["id"]
    book = client.get(f"/api/books/{book_id}").json()
    assert book["status"] == "failed" and book["error"]


def test_position_round_trip_and_continue_reading(client, files):
    a = upload(client, files["epub"], genre_id="fiction").json()["id"]
    b = upload(client, files["pdf"], genre_id="selfhelp").json()["id"]
    assert client.get(f"/api/books/{a}/position").json() is None

    client.put(f"/api/books/{a}/position", json={"location": "epubcfi(/6/4!/4/2)", "progress": 0.4, "chapter_href": "chap_2.xhtml"})
    client.put(f"/api/books/{b}/position", json={"location": "2", "progress": 0.66})
    pos = client.get(f"/api/books/{a}/position").json()
    assert pos["location"] == "epubcfi(/6/4!/4/2)" and pos["progress"] == 0.4
    # The most recently read unfinished book wins.
    assert client.get("/api/continue").json()["id"] == b
    client.put(f"/api/books/{b}/position", json={"location": "3", "progress": 1.0})
    assert client.get("/api/continue").json()["id"] == a
    assert client.put(f"/api/books/{a}/position", json={"location": "x", "progress": 1.5}).status_code == 422


def test_search_finds_titles_genres_and_passages(client, files):
    upload(client, files["epub"], genre_id="fiction")
    res = client.get("/api/search", params={"q": "white whale"}).json()
    assert res["passages"] and res["passages"][0]["chapter_title"] == "Chapter II. The Whale"
    assert "white whale" in res["passages"][0]["snippet"].lower()
    assert client.get("/api/search", params={"q": "grey harbour"}).json()["books"]
    assert client.get("/api/search", params={"q": "fict"}).json()["genres"][0]["id"] == "fiction"


def test_delete_book_removes_it(client, files):
    book_id = upload(client, files["epub"], genre_id="fiction").json()["id"]
    assert client.delete(f"/api/books/{book_id}").status_code == 204
    assert client.get(f"/api/books/{book_id}").status_code == 404
