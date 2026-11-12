class DjangoRepository:
    def save(self, entity):
        entity.full_clean()
        entity.save()
        return entity

    def add(self, entity):
        return self.save(entity)

    def remove(self, entity):
        entity.delete()
